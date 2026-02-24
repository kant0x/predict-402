const hre = require("hardhat");

async function main() {
    console.log("Starting...");
    const BOT_PK = process.env.PRIVATE_KEY; // Set via .env
    const predictAddress = "0xc0d3b105382E60c2a89cfdB83919ebb43bD977fE"; // New Predict402

    // We already have hardhat provider
    const provider = hre.ethers.provider;
    const wallet = new hre.ethers.Wallet(BOT_PK, provider);

    console.log("Using bot wallet:", wallet.address);
    const abi = ["function registerNickname(string memory _nickname) external"];
    const predict = new hre.ethers.Contract(predictAddress, abi, wallet);

    console.log("Registering nickname...");
    const tx = await predict.registerNickname("BitQuant Trading");
    await tx.wait();
    console.log("Nickname registered successfully!");
}

main().catch(console.error);
