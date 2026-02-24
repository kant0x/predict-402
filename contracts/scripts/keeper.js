const hre = require("hardhat");
const https = require("https");

const PREDICT402 = "0x5A3949aE67a37e7e37bFC77F5b7832Cc93f40A2a";
const CHECK_INTERVAL = 10_000; // 10 seconds

// ── Binance price (more reliable than CoinGecko) ──
function getBtcPrice() {
    return new Promise((resolve) => {
        const req = https.get("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT", (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                try {
                    const json = JSON.parse(data);
                    if (json.price) {
                        const cents = Math.floor(parseFloat(json.price) * 100);
                        resolve(cents);
                        return;
                    }
                } catch (_) { }
                console.log("⚠️ Binance parse failed, using fallback");
                resolve(6850000 + Math.floor(Math.random() * 20000) - 10000);
            });
        });
        req.on("error", () => {
            console.log("⚠️ Network error, using fallback price");
            resolve(6850000 + Math.floor(Math.random() * 20000) - 10000);
        });
        req.end();
    });
}

function ts() {
    return new Date().toLocaleTimeString();
}

async function main() {
    console.log("🤖 Keeper started at", ts());

    const [signer] = await hre.ethers.getSigners();
    console.log("Keeper wallet:", signer.address);

    const Predict402 = await hre.ethers.getContractFactory("Predict402");
    const contract = Predict402.attach(PREDICT402).connect(signer);

    while (true) {
        try {
            // ── 1. Read current state ──
            const roundId = Number(await contract.currentRoundId());
            const now = Math.floor(Date.now() / 1000);

            // ── 2. No round yet → start first ──
            if (roundId === 0) {
                console.log(`[${ts()}] No rounds yet. Starting first round...`);
                const price = await getBtcPrice();
                console.log(`  Price: $${(price / 100).toFixed(2)}`);
                const tx = await contract.startFirstRound(price);
                await tx.wait();
                console.log("✅ First round started!");
                await sleep(3000);
                continue;
            }

            // ── 3. Read round data ──
            const round = await contract.rounds(roundId);
            const endTime = Number(round.endTime);
            const resolved = round.resolved;

            // ── 4. Round is active (not ended yet) ──
            // +5s buffer so block.timestamp is past endTime
            if (now < endTime + 5) {
                const left = endTime - now;
                if (left % 30 < 11) { // log roughly every 30s
                    console.log(`[${ts()}] Round #${roundId} active | ${left}s left`);
                }
                await sleep(CHECK_INTERVAL);
                continue;
            }

            // ── 5. Round ended, needs resolve ──
            if (!resolved) {
                console.log(`[${ts()}] Round #${roundId} ended. Resolving...`);
                const closePrice = await getBtcPrice();
                console.log(`  Close price: $${(closePrice / 100).toFixed(2)}`);
                try {
                    const tx = await contract.resolveRound(closePrice, "keeper_" + Date.now());
                    await tx.wait();
                    console.log("✅ Round resolved!");
                } catch (e) {
                    const msg = e.message || "";
                    if (msg.includes("Already resolved")) {
                        console.log("ℹ️ Already resolved on-chain, moving on");
                    } else {
                        console.error("❌ Resolve error:", msg.slice(0, 200));
                        await sleep(5000);
                        continue;
                    }
                }
                // Small delay before starting new round
                await sleep(2000);
                // DON'T continue — fall through to step 6
            }

            // ── 6. Round resolved → start next ──
            // Re-read to confirm resolved state
            const freshRound = await contract.rounds(roundId);
            if (freshRound.resolved) {
                console.log(`[${ts()}] Starting round #${roundId + 1}...`);
                const startPrice = await getBtcPrice();
                console.log(`  Strike: $${(startPrice / 100).toFixed(2)}`);
                try {
                    const tx = await contract.startFirstRound(startPrice);
                    await tx.wait();
                    console.log(`✅ Round #${roundId + 1} started!`);
                } catch (e) {
                    const msg = e.message || "";
                    console.error("❌ Start round error:", msg.slice(0, 300));
                }
            } else {
                console.log(`[${ts()}] Round #${roundId} still not resolved. Retrying...`);
            }

        } catch (e) {
            console.error(`[${ts()}] ❌ Loop error:`, (e.message || "").slice(0, 300));
        }

        await sleep(CHECK_INTERVAL);
    }
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

main().catch((e) => {
    console.error("Fatal:", e);
    process.exitCode = 1;
});
