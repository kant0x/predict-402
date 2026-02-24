const hre = require("hardhat");
const axios = require("axios");

const PREDICT402 = "0x5A3949aE67a37e7e37bFC77F5b7832Cc93f40A2a";

async function getCurrentBtcPrice() {
    try {
        const response = await axios.get(
            "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"
        );
        const priceUsd = parseFloat(response.data.price);
        return Math.floor(priceUsd * 100);
    } catch (error) {
        return 9700000; // Fallback
    }
}

async function main() {
    console.log("🔧 Resolving and starting new round...\n");

    const [signer] = await hre.ethers.getSigners();
    console.log("Signer:", signer.address);

    const Predict402 = await hre.ethers.getContractFactory("Predict402");
    const contract = Predict402.attach(PREDICT402).connect(signer);

    try {
        const currentRoundId = await contract.currentRoundId();
        console.log("Current Round ID:", currentRoundId.toString());
    } catch (e) {
        console.log("Cannot read round ID");
    }

    // Get closing price
    console.log("\n📊 Fetching current BTC price for closing...");
    const closingPrice = await getCurrentBtcPrice();
    console.log(`Closing Price: $${(closingPrice / 100).toLocaleString()}`);

    // Resolve current round
    console.log("\n🎯 Resolving current round...");
    try {
        const proofHash = "0xRESOLVE_" + Date.now();
        const tx = await contract.resolveRound(closingPrice, proofHash, {
            gasLimit: 1000000
        });
        console.log("Resolve TX sent:", tx.hash);
        console.log("Waiting for confirmation...");

        const receipt = await tx.wait();
        if (receipt.status === 1) {
            console.log("✅ Round resolved successfully!");
            console.log("Gas used:", receipt.gasUsed.toString());
        } else {
            console.log("❌ Resolution failed (reverted)");
            return;
        }
    } catch (error) {
        console.error("❌ Error resolving:", error.message);
        if (error.message.includes("Round not ended yet")) {
            console.log("\n💡 Round is still active. Wait until it ends.");

            try {
                const endTime = await contract.roundEndTime();
                const now = Math.floor(Date.now() / 1000);
                const timeLeft = Number(endTime) - now;

                if (timeLeft > 0) {
                    console.log(`⏳ Round ends in ${Math.floor(timeLeft / 60)}m ${timeLeft % 60}s`);
                    console.log(`   End time: ${new Date(Number(endTime) * 1000).toLocaleString()}`);
                }
            } catch (e) { }
        }
        return;
    }

    // Start new round
    console.log("\n🚀 Starting new round...");
    const newStrikePrice = await getCurrentBtcPrice();
    console.log(`New Strike Price: $${(newStrikePrice / 100).toLocaleString()}`);

    try {
        const tx = await contract.startNewRound(newStrikePrice, {
            gasLimit: 500000
        });
        console.log("Start TX sent:", tx.hash);

        const receipt = await tx.wait();
        if (receipt.status === 1) {
            console.log("✅ New round started!");

            try {
                const newRoundId = await contract.currentRoundId();
                const endTime = await contract.roundEndTime();
                console.log("\n📊 New Round:");
                console.log("Round ID:", newRoundId.toString());
                console.log("End Time:", new Date(Number(endTime) * 1000).toLocaleString());
            } catch (e) { }
        }
    } catch (error) {
        console.error("❌ Error starting round:", error.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
