# Frequently Asked Questions

## General

### What is NOCTIS?

NOCTIS is a zero-knowledge privacy protocol on Base. It lets you transfer NOCTIS tokens privately, breaking the on-chain link between sender and receiver.

### How does it work?

When you deposit, a cryptographic commitment is stored on-chain. When you withdraw, you generate a ZK proof that you know the secret behind one of the commitments - without revealing which one. This makes deposits and withdrawals unlinkable.

### Is it safe?

The protocol uses battle-tested cryptography:
- **Groth16** zero-knowledge proofs
- **Poseidon** hash function (designed for ZK circuits)
- **BN254** elliptic curve (same as Ethereum precompiles)

However, your funds' safety depends on you keeping your notes secure.

---

## Privacy

### What information is private?

- Which deposit you're spending (unlinkable)
- Your identity as the depositor

### What information is public?

- Deposit amounts
- Withdrawal amounts
- Recipient addresses
- Transaction timing

### Can anyone see my balance?

No one can see your "private balance" in the vault. They can see individual deposits and withdrawals, but can't link them together.

---

## Notes & Security

### What is a "note"?

A note is a JSON object containing your secret keys (`spendingKey`, `randomness`) and deposit info (`balance`, `commitment`, `noteIndex`). It's proof that you own funds in the vault.

### What happens if I lose my note?

Your funds are lost forever. There is no recovery mechanism - this is what makes the protocol trustless and private.

### Can someone steal my funds if they get my note?

Yes. Your note is like a private key - anyone with it can withdraw your funds. Keep it secret and secure.

### Are my notes stored on-chain?

No. Only the commitment hash is stored on-chain. Your secrets (`spendingKey`, `randomness`) never leave your browser.

---

## Technical

### Why does proof generation take so long?

ZK proofs are computationally intensive. Your browser is essentially running a small computation that proves something without revealing the inputs. 10-30 seconds is normal.

### What network does NOCTIS use?

Base (Coinbase's L2). Make sure your wallet is connected to Base.

### Can I use NOCTIS on other chains?

Currently only Base is supported. Cross-chain support is on the roadmap.

### Is the code open source?

Yes. Check out [GitHub](https://github.com/zkNOCTIS/NOCTIS).

---

## Fees

### Are there any fees?

Currently there are no protocol fees. You only pay Base network gas fees.

### Will there be fees in the future?

Multi-token support (ETH, USDC) will include NOCTIS fees. See the roadmap for details.
