
import { ethers } from 'ethers';

const RPC_URL = 'https://sepolia.base.org';
const TOKEN_ADDRESS = "0xf863f3A311743fb4B51d289EeDf5F8a61190eA48";
const VAULT_ADDRESS = "0x441F619ff56d516474b3e0c1608eeA44a3a6E486"; // V5

const TOKEN_ABI = [
    "function balanceOf(address account) external view returns (uint256)",
    "function decimals() external view returns (uint8)",
    "function symbol() external view returns (string)"
];

async function main() {
    console.log('Connecting to RPC:', RPC_URL);
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    try {
        const network = await provider.getNetwork();
        console.log('Connected to network:', network.name, network.chainId);
    } catch (err) {
        console.error('Failed to connect to RPC:', err.message);
        return;
    }

    const token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, provider);

    try {
        console.log('Fetching token info...');
        const symbol = await token.symbol();
        const decimals = await token.decimals();
        console.log('Token:', symbol, 'Decimals:', decimals);

        console.log('Fetching vault balance...');
        const balance = await token.balanceOf(VAULT_ADDRESS);
        console.log('Vault Balance (Wei):', balance.toString());
        console.log('Vault Balance (Formatted):', ethers.formatUnits(balance, decimals));
    } catch (err) {
        console.error('Failed to fetch token data:', err.message);
    }
}

main();
