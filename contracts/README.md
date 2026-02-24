# AI Oracle Smart Contracts

## Setup & Deploy

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   - Create a `.env` file (copy `.env.example`)
   - Add your wallet `PRIVATE_KEY` (must have testnet OGETH)

3. **Deploy to OpenGradient Testnet**
   ```bash
   npx hardhat run scripts/deploy.js --network opengradient
   ```

4. **Update Frontend**
   - Copy the deployed contract address (from terminal output).
   - Paste it into `frontend/src/config/contracts.ts`:
     ```typescript
     export const VAULT402_ADDRESS = '0xYourNewAddress';
     ```
