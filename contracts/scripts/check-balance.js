const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Checking balance for account:", deployer.address);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Balance:", hre.ethers.formatEther(balance), "OGETH");

    if (balance === 0n) {
        console.log("\n❌ BALANCE IS ZERO! Please request funds from faucet.");
        console.log("Run: https://faucet.opengradient.ai (Address: " + deployer.address + ")");
    } else {
        console.log("\n✅ Balance is sufficient.");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
