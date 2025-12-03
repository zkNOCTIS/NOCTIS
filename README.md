# NOCTIS

A zero-knowledge privacy protocol for the NOCTIS token on Base. Deposit NOCTIS into a shielded pool and withdraw to any address - breaking the on-chain link between sender and receiver.

## How It Works

1. **Deposit**: Deposit NOCTIS tokens → receive a private "note" containing your secret keys
2. **Withdraw**: Generate a ZK proof proving you own a valid note → withdraw to any address
3. **Privacy**: The ZK proof reveals nothing about which deposit you're spending. Deposits and withdrawals are completely unlinkable.

## Tech Stack

- **Smart Contracts**: Solidity + Foundry
- **ZK Proofs**: Groth16 via circom/snarkjs
- **Hash Function**: Poseidon on BN254 (alt_bn128)
- **Merkle Tree**: 20 levels
- **Frontend**: React + Vite
- **Chain**: Base

## Architecture

```
User deposits NOCTIS
        ↓
   ┌─────────────┐
   │ BalanceVault │ ← Stores commitment in Merkle tree
   └─────────────┘
        ↓
User receives Note (spendingKey, randomness)
        ↓
User generates ZK proof in browser
        ↓
   ┌─────────────┐     ┌──────────────┐
   │ BalanceVault │ ──→ │   Verifier   │ ← Validates proof
   └─────────────┘     └──────────────┘
        ↓
NOCTIS sent to recipient (no link to deposit)
```

## Security

- **Notes are bearer assets** - anyone with the note can withdraw
- **Back up your notes** - lost notes = lost funds
- **Secrets stay client-side** - spending keys never touch the blockchain

## Why NOCTIS?

NOCTIS is the only token on Base with native ZK privacy. To use the privacy vault, you must hold NOCTIS - creating natural demand from anyone seeking private transactions.

**Future utility:**
- Pay fees in NOCTIS for multi-token privacy (ETH, USDC)
- Staking rewards for liquidity providers
- Governance over protocol parameters

## Roadmap

- ✅ **Phase 1** - ZK privacy vault (Groth16 proofs, Poseidon hashing)
- 🔄 **Phase 2** - Multi-token support (ETH, USDC, WBTC)
- 📋 **Phase 3** - Protocol fees & staking
- 📋 **Phase 4** - Cross-chain privacy bridge

## Links

- [Website](https://noctis.finance)
- [Documentation](https://docs.noctis.finance)
- [Twitter](https://twitter.com/noctisprotocol)

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<h3 align="center">NOCTIS - Privacy for the people</h3>
