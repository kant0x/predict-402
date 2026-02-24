const hre = require("hardhat");

const VAULT_ADDRESS = "0x56f0B8d4224ee8686dd69D8F6018Ae05c2526CEC"; // From backend/.env

const VAULT_ABI = [
    "function placeBetFromVault(address _user, bool _isUp, uint256 _amount) external",
    "function getBalance(address _user) external view returns (uint256)",
    "function owner() external view returns (address)",
    "function aiAgent() external view returns (address)"
];

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Debugger running with account:", deployer.address);

    const vault = new hre.ethers.Contract(VAULT_ADDRESS, VAULT_ABI, deployer);

    // 1. Check Owner and Agent
    try {
        const owner = await vault.owner();
        console.log("Vault Owner:", owner);
    } catch (e) {
        console.log("Could not fetch owner (maybe not in ABI or contract differs)");
    }

    try {
        const agent = await vault.aiAgent();
        console.log("Vault Agent:", agent);
        if (agent.toLowerCase() === deployer.address.toLowerCase()) {
            console.log("✅ signer IS the agent");
        } else {
            console.log("❌ signer IS NOT the agent");
        }
    } catch (e) {
        console.log("Could not fetch aiAgent");
    }

    // 2. Simulate Bet
    const amount = hre.ethers.parseEther("0.0001");
    const isUp = true;

    // Use signer address as player for test
    const player = deployer.address;

    console.log(`Simulating placeBetFromVault(${player}, ${isUp}, ${amount})...`);

    try {
        // Call static to see looking for revert
        await vault.placeBetFromVault.staticCall(player, isUp, amount);
        console.log("✅ Simulation SUCCESS! Transaction should pass.");
    } catch (error) {
        console.log("❌ Simulation FAILED:");
        if (error.reason) console.log("Reason:", error.reason);
        else if (error.data) console.log("Data:", error.data);
        else console.log(error);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
