const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const Predict402 = await hre.ethers.getContractFactory("Predict402");
    // Constructor in Predict402 takes 0 arguments
    const predict = await Predict402.deploy();
    await predict.waitForDeployment();
    const predictAddress = await predict.getAddress();
    console.log("Predict402 deployed to:", predictAddress);

    const Vault402 = await hre.ethers.getContractFactory("Vault402Binary");
    // Constructor in Vault402Binary takes 0 arguments. We pass [] explicitly.
    console.log("Deploying Vault402Binary with [] args...");
    const vault = await Vault402.deploy();
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    console.log("Vault402 deployed to:", vaultAddress);

    // Connect them
    await predict.setVault(vaultAddress);
    console.log("Predict402 -> setVault -> Success");

    await vault.setPredictContract(predictAddress);
    console.log("Vault402 -> setPredictContract -> Success");

    // Set AI Agent (The Bot, not the Owner) 
    const BOT_ADDRESS = "0x8AeE42b7ac85f412c236c98b3f8c8970cF272cEE";

    await predict.setAiAgent(BOT_ADDRESS);
    await vault.setAiAgent(BOT_ADDRESS);
    console.log("AI Agent set to Bot:", BOT_ADDRESS);

    // Fund Bot for gas start
    const fundAmount = hre.ethers.parseEther("0.1");
    // Check sender balance first
    const bal = await hre.ethers.provider.getBalance(deployer.address);
    if (bal > fundAmount) {
        const tx = await deployer.sendTransaction({
            to: BOT_ADDRESS,
            value: fundAmount
        });
        await tx.wait();
        console.log("Sent 0.1 ETH to Bot for gas start. Tx:", tx.hash);
    } else {
        console.log("WARNING: Deployer needs more ETH to fund Bot.");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
