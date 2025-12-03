/**
 * NOCTIS SDK Usage Examples
 *
 * Run with: node example-usage.js
 * Requires: npm install ethers
 */

const { ethers } = require('ethers');
const { NoctisSDK, NoctisWallet, Note, ADDRESSES } = require('./noctis-sdk');

// Base Sepolia RPC
const RPC_URL = 'https://sepolia.base.org';

async function main() {
    console.log('\n=== NOCTIS Privacy Vault SDK Examples ===\n');

    // Connect to Base Sepolia
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    console.log('Connected to Base Sepolia');
    console.log('Addresses:', ADDRESSES.baseSepolia);

    // For read-only operations
    const sdk = new NoctisSDK(provider);

    // ==================== READ-ONLY EXAMPLES ====================

    console.log('\n--- Read-Only Operations ---');

    // Get current Merkle root
    const root = await sdk.getCurrentRoot();
    console.log('Current Merkle Root:', root);

    // Get note count
    const noteCount = await sdk.getNoteCount();
    console.log('Total Notes:', noteCount);

    // ==================== WALLET MANAGEMENT ====================

    console.log('\n--- Wallet Management ---');

    // Create a new wallet
    const wallet = new NoctisWallet();

    // Create notes for deposit
    const amount = ethers.parseEther('10000'); // 10,000 NOCTIS
    const note1 = Note.create(amount);

    console.log('Created Note:');
    console.log('  Commitment:', note1.commitment);
    console.log('  Balance:', ethers.formatEther(note1.balance), 'NOCTIS');

    // Add to wallet
    wallet.addNote(note1);
    console.log('Wallet Balance:', ethers.formatEther(wallet.getTotalBalance()), 'NOCTIS');

    // Export wallet (for backup)
    const backup = wallet.export();
    console.log('\nWallet Backup (save this securely!):');
    console.log(backup.substring(0, 100) + '...');

    // ==================== DEPOSIT FLOW (with signer) ====================

    console.log('\n--- Deposit Flow (requires funded wallet) ---');
    console.log(`
    // With a funded signer:
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    const sdkWithSigner = new NoctisSDK(provider, signer);

    // Deposit 10,000 NOCTIS
    const { note, tx } = await sdkWithSigner.deposit(ethers.parseEther('10000'));
    console.log('Deposit TX:', tx.hash);
    console.log('Note Index:', note.noteIndex);

    // Save note to wallet
    wallet.addNote(note);
    `);

    // ==================== WITHDRAWAL FLOW ====================

    console.log('\n--- Withdrawal Flow ---');
    console.log(`
    // Full withdrawal to recipient
    const { tx: withdrawTx } = await sdkWithSigner.withdraw(
        note,
        '0xRecipientAddress',
        note.balance // Full amount
    );

    // Partial withdrawal with change
    const { tx: partialTx, changeNote } = await sdkWithSigner.withdraw(
        note,
        '0xRecipientAddress',
        ethers.parseEther('5000') // Partial
    );

    // Save change note for later use
    if (changeNote) {
        wallet.addNote(changeNote);
        wallet.removeNote(note.commitment);
    }
    `);

    // ==================== GAS-FREE WITHDRAWAL ====================

    console.log('\n--- Gas-Free Withdrawal (via Relayer) ---');
    console.log(`
    // For fresh wallets with no ETH
    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour
    const fee = ethers.parseEther('100'); // 100 NOCTIS fee

    const {
        proof,
        publicInputs,
        signature,
        changeNote
    } = await sdkWithSigner.signGasFreeWithdrawal(
        note,
        '0xFreshWalletAddress',
        ethers.parseEther('5000'),
        fee,
        deadline
    );

    // Send proof + signature to relayer service (or call contract directly)
    // Relayer will execute and take the fee
    `);

    // ==================== PRIVACY BEST PRACTICES ====================

    console.log('\n--- Privacy Best Practices ---');
    console.log(`
    1. NEVER withdraw the same amount you deposited
       - Deposit: 12,345 NOCTIS
       - Withdraw: 5,000, then 4,000, then 3,345

    2. Wait between deposits and withdrawals
       - Larger anonymity set = better privacy

    3. Use different recipient addresses
       - Don't withdraw to the same address you deposited from

    4. Consider multiple deposits/withdrawals
       - Split large amounts across multiple notes

    5. Store wallet backups securely
       - Losing the spending key = losing funds
       - Never share your spending key
    `);

    console.log('\n=== Examples Complete ===\n');
}

main().catch(console.error);
