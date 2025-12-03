# Getting Started

## What is NOCTIS?

NOCTIS is a zero-knowledge privacy protocol on Base. It allows you to deposit tokens into a shielded pool and withdraw them to any address without creating an on-chain link between the deposit and withdrawal.

## How It Works

1. **Deposit** - Send NOCTIS tokens to the privacy vault
2. **Receive Note** - Get a secret "note" containing your private keys
3. **Withdraw or Share** - Withdraw to any address or share a ClaimLink

The magic happens through zero-knowledge proofs. When you withdraw, you prove you own a valid note without revealing which deposit it came from.

## Requirements

### For Deposits
- A wallet (MetaMask, Rabby, etc.)
- Some ETH on Base for gas fees
- NOCTIS tokens to deposit

### For Withdrawals
- **No wallet required!** The relayer pays gas on your behalf
- Just paste a recipient address and claim

## ClaimLinks

You can create shareable links to send NOCTIS privately:

1. Create a ClaimLink from any note
2. Share the link with anyone
3. They can claim to any address without needing ETH

This enables truly private payments - no wallet addresses are exchanged.

## Important Security Notes

- **Your note is everything** - Anyone with your note can withdraw your funds
- **Back up immediately** - If you lose your note, your funds are lost forever
- **ClaimLinks give full access** - Only share with intended recipients

## Next Steps

- [How to Deposit](deposit.md)
- [How to Withdraw](withdraw.md)
- [Backup & Recovery](backup.md)
