
const hre = require("hardhat");

const PREDICT402 = "0x5A3949aE67a37e7e37bFC77F5b7832Cc93f40A2a";

async function main() {
    console.log("🛠 Checking Predict402 status...");

    const [signer] = await hre.ethers.getSigners();
    console.log("Owner:", signer.address);

    const Predict402 = await hre.ethers.getContractFactory("Predict402");
    // Connect to deployed contract
    const contract = Predict402.attach(PREDICT402).connect(signer);

    // Read state
    const currentRoundId = await contract.currentRoundId();
    const roundEndTime = await contract.roundEndTime();
    const now = Math.floor(Date.now() / 1000);

    console.log(`Current Round: #${currentRoundId}`);
    console.log(`Round Ends:    ${new Date(Number(roundEndTime) * 1000).toLocaleString()}`);
    console.log(`Current Time:  ${new Date().toLocaleString()}`);

    if (now > Number(roundEndTime)) {
        console.log("\n⚠️ Round has ended! Attempting to resolve...");

        // Mock resolution data
        const mockPrice = 9700000; // $97,000.00
        const mockHash = "0xMOCK_RESOLVE_HASH_" + Date.now();

        try {
            const tx = await contract.resolveRound(mockPrice, mockHash);
            console.log("Transaction sent:", tx.hash);
            await tx.wait();
            console.log("✅ Round Resolved! New round started.");
        } catch (e) {
            console.error("❌ Failed to resolve round:", e.message);
            // Check if reason is "Round not ended yet" or "Already resolved"
        }
    } else {
        const timeLeft = Number(roundEndTime) - now;
        console.log(`✅ Round is ACTIVE. Ends in ${Math.floor(timeLeft / 60)}m ${timeLeft % 60}s.`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
