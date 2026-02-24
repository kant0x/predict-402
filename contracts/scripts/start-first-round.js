const hre = require("hardhat");
const axios = require("axios");
const PREDICT402 = "0x5A3949aE67a37e7e37bFC77F5b7832Cc93f40A2a";

async function getCurrentBtcPrice() {
    try {
        const response = await axios.get(
            "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"
        );
        const priceUsd = parseFloat(response.data.price);
        return Math.floor(priceUsd * 100); // Convert to cents
    } catch (error) {
        console.error("Failed to fetch BTC price from Binance:", error.message);
        return 9700000; // Fallback: $97,000.00
    }
}

async function main() {
    console.log("🚀 Starting first round...");

    const [signer] = await hre.ethers.getSigners();
    console.log("Owner:", signer.address);

    const Predict402 = await hre.ethers.getContractFactory("Predict402");
    const contract = Predict402.attach(PREDICT402).connect(signer);

    // Get current BTC price
    console.log("📊 Fetching BTC price from Binance...");
    const strikePrice = await getCurrentBtcPrice();
    console.log(`Strike Price: $${(strikePrice / 100).toLocaleString()}`);

    // Check if round already exists
    const currentRoundId = await contract.currentRoundId();
    console.log("Current Round ID:", currentRoundId.toString());

    if (currentRoundId > 0n) {
        const roundInfo = await contract.rounds(currentRoundId);
        if (!roundInfo.resolved) {
            console.log("⚠️ Active round already exists. No need to start new one.");
            return;
        }
    }

    // Start first round
    console.log("🎯 Starting first round...");
    const tx = await contract.startFirstRound(strikePrice);
    console.log("Transaction sent:", tx.hash);

    const receipt = await tx.wait();
    console.log("✅ First round started!");
    console.log("Round ID:", (await contract.currentRoundId()).toString());
    console.log("Strike Price:", strikePrice, "cents");
    console.log("End Time:", new Date(Number(await contract.roundEndTime()) * 1000).toLocaleString());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
