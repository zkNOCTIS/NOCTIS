# How to Withdraw

**No wallet or ETH required for withdrawals!** The relayer pays gas on your behalf.

## Option 1: Withdraw from Saved Notes

If your note is already saved in the app:

1. Go to the **Withdraw** card
2. Select the note you want to spend
3. Enter the recipient address (can be any wallet)
4. Enter the amount to withdraw
5. Click **Withdraw**

## Option 2: Withdraw from Pasted Note

If you're restoring from a backup:

1. Go to the **Withdraw** card
2. Click **Paste note manually**
3. Paste your note JSON
4. Enter the recipient address
5. Enter the amount
6. Click **Withdraw**

## Option 3: ClaimLinks

Create shareable payment links:

1. Go to **My Notes**
2. Click the link icon on any note
3. Copy the ClaimLink
4. Share with the recipient

The recipient opens the link and claims to any address - no wallet connection needed!

## Partial Withdrawals

You don't have to withdraw the full amount. For example:

- Note contains 1,000 NOCTIS
- You withdraw 300 NOCTIS to an address
- A new note with 700 NOCTIS is automatically created

The "change" note is saved to the claimer's browser.

## What Happens During Withdrawal

1. **Proof Generation** (10-30 seconds) - Your browser generates a zero-knowledge proof
2. **Relayer Submission** - The relayer submits the transaction and pays gas
3. **Verification** - The smart contract verifies the proof
4. **Transfer** - NOCTIS is sent to the recipient address
5. **Nullifier** - Your note's nullifier is recorded to prevent double-spending

## Privacy

- The recipient address is visible on-chain
- The withdrawal amount is visible on-chain
- **Nothing links the withdrawal to the original deposit**
- An observer cannot tell which deposit you're spending
- Using ClaimLinks means no wallet addresses are exchanged between sender and receiver

## Note Syncing

Your notes automatically sync with the blockchain every 5 minutes. If someone claims a note you shared via ClaimLink, it will automatically be marked as spent.

## Next Steps

- [Backup & Recovery](backup.md)
- [Troubleshooting](troubleshooting.md)
