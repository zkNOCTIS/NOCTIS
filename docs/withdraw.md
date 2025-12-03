# How to Withdraw

## Option 1: Withdraw from Saved Notes

If your note is already saved in the app:

1. Go to the **Withdraw** card
2. Click **Use saved notes**
3. Select the note you want to spend
4. Enter the recipient address (can be any wallet)
5. Enter the amount to withdraw
6. Click **Withdraw**

## Option 2: Withdraw from Pasted Note

If you're restoring from a backup:

1. Go to the **Withdraw** card
2. Paste your note JSON in the text area
3. The app will validate your note
4. Enter the recipient address
5. Enter the amount
6. Click **Withdraw**

## Partial Withdrawals

You don't have to withdraw the full amount. For example:

- Note contains 1,000 NOCTIS
- You withdraw 300 NOCTIS to an address
- A new note with 700 NOCTIS is automatically created

The new "change" note will appear in your saved notes.

## What Happens During Withdrawal

1. **Proof Generation** (10-30 seconds) - Your browser generates a zero-knowledge proof
2. **Verification** - The smart contract verifies the proof
3. **Transfer** - NOCTIS is sent to the recipient address
4. **Nullifier** - Your note's nullifier is recorded to prevent double-spending

## Privacy

- The recipient address is visible on-chain
- The withdrawal amount is visible on-chain
- **Nothing links the withdrawal to the original deposit**
- An observer cannot tell which deposit you're spending

## Next Steps

- [Backup & Recovery](backup.md)
- [Troubleshooting](troubleshooting.md)
