# Getting Started

## What is NOCTIS?

NOCTIS is a zero-knowledge privacy protocol on Base. It allows you to deposit tokens into a shielded pool and withdraw them to any address without creating an on-chain link between the deposit and withdrawal.

## How It Works

1. **Deposit** - Send NOCTIS tokens to the privacy vault
2. **Receive Note** - Get a secret "note" containing your private keys
3. **Withdraw** - Use your note to withdraw to any address privately

The magic happens through zero-knowledge proofs. When you withdraw, you prove you own a valid note without revealing which deposit it came from.

## Requirements

- A wallet (MetaMask, Rabby, etc.)
- Some ETH on Base for gas fees
- NOCTIS tokens to deposit

## Important Security Notes

- **Your note is everything** - Anyone with your note can withdraw your funds
- **Back up immediately** - If you lose your note, your funds are lost forever
- **Never share your note** - It contains your spending keys

## Next Steps

- [How to Deposit](deposit.md)
- [How to Withdraw](withdraw.md)
- [Backup & Recovery](backup.md)
