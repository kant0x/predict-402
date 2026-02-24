const hre = require("hardhat");

async function main() {
    console.log("Starting full deployment (Predict402 + Vault402)...\n");

    // ── 1. Deploy Predict402 (UP/DOWN binary prediction market) ──
    console.log("Deploying Predict402...");
    const Predict402 = await hre.ethers.getContractFactory("Predict402");
    const predict = await Predict402.deploy();
    await predict.waitForDeployment();
    const predictAddress = await predict.getAddress();
    console.log("✅ Predict402 deployed to:", predictAddress);

    // ── 2. Deploy Vault402 (deposit vault) ──
    console.log("\nDeploying Vault402...");
    const Vault402 = await hre.ethers.getContractFactory("Vault402");
    const vault = await Vault402.deploy(predictAddress);
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    console.log("✅ Vault402 deployed to:", vaultAddress);

    // ── 3. Link contracts: set Vault address on Predict402 ──
    console.log("\nLinking: Predict402.setVault(Vault402)...");
    const txSetVault = await predict.setVault(vaultAddress);
    await txSetVault.wait();
    console.log("✅ Vault linked on Predict402");

    // ── 4. Authorize Predict402 as spender on Vault402 ──
    console.log("Linking: Vault402.setGameContract(Predict402)...");
    const txSetGame = await vault.setGameContract(predictAddress);
    await txSetGame.wait();
    console.log("✅ Predict402 authorized on Vault402");

    // ── Summary ──
    console.log("\n═══════════════════════════════════════════════════");
    console.log("  Predict402:", predictAddress);
    console.log("  Vault402:  ", vaultAddress);
    console.log("═══════════════════════════════════════════════════");
    console.log("\nUpdate these files with new addresses:");
    console.log("  1. frontend/src/config/contracts.ts");
    console.log("     PREDICT402_ADDRESS =", predictAddress);
    console.log("     VAULT402_ADDRESS   =", vaultAddress);
    console.log("  2. backend/.env");
    console.log("     CONTRACT_ADDRESS=" + predictAddress);
    console.log("     VAULT_ADDRESS=" + vaultAddress);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
