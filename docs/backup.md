# Backup & Recovery

## Why Backup?

Your notes are stored in your browser's localStorage. They can be lost if:

- You clear browser data
- You switch browsers or devices
- Your browser crashes
- You reinstall your browser

**If you lose your notes, your funds are lost forever.** There is no recovery mechanism.

## How to Backup

### Method 1: Copy Individual Note

1. Go to **My Notes**
2. Click the copy icon on any note
3. Save the JSON somewhere safe

### Method 2: Export All Notes

1. Go to **My Notes**
2. Click **Backup**
3. Click **Download Backup**
4. Save the JSON file securely

## How to Restore

### Method 1: Import Backup File

1. Go to **My Notes**
2. Click **Backup**
3. Paste your backup JSON
4. Click **Import Notes**

### Method 2: Paste Note to Withdraw

1. Go to **Withdraw**
2. Paste your note JSON directly
3. Proceed with withdrawal

## Note Format

A note looks like this:

```json
{
  "spendingKey": "123456...",
  "randomness": "789012...",
  "balance": "1000000000000000000",
  "commitment": "345678...",
  "noteIndex": 42
}
```

All fields are required to withdraw. The `spendingKey` and `randomness` are your secrets.

## Best Practices

- Backup immediately after every deposit
- Store backups in multiple locations
- Use encrypted storage (password manager, encrypted drive)
- Never share your notes with anyone
- Test your backup by importing it before depositing large amounts

## Lost Note Recovery

If you lost your note but remember the deposit transaction:

Unfortunately, **there is no recovery**. The `spendingKey` and `randomness` are generated client-side and never touch the blockchain. Without them, no one can withdraw the funds.

This is a feature, not a bug - it's what makes the protocol truly private.
