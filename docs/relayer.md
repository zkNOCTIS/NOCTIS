# Relayer Setup

The relayer is a backend service that submits withdrawal transactions on behalf of users. This enables gasless withdrawals - users don't need ETH to claim their funds.

## Requirements

- Node.js 18+
- A funded wallet on Base (for gas fees)
- Access to a Base RPC endpoint

## Installation

```bash
cd relayer
npm install
```

## Configuration

Create a `.env` file in the `relayer/` directory:

```env
RELAYER_PRIVATE_KEY=0x...your_private_key...
RPC_URL=https://mainnet.base.org
VAULT_ADDRESS=0x...vault_contract_address...
TOKEN_ADDRESS=0x...token_contract_address...
RELAYER_FEE_BPS=0
PORT=3001
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `RELAYER_PRIVATE_KEY` | Private key of the wallet that will pay gas fees |
| `RPC_URL` | Base RPC endpoint |
| `VAULT_ADDRESS` | Address of the NOCTIS vault contract |
| `TOKEN_ADDRESS` | Address of the NOCTIS token contract |
| `RELAYER_FEE_BPS` | Fee in basis points (100 = 1%). Set to 0 for no fee |
| `PORT` | Port to run the relayer on (default: 3001) |

## Running

```bash
node index.js
```

Or with npm:

```bash
npm start
```

You should see:
```
Relayer address: 0x...
NOCTIS Relayer running on port 3001
Fee: 0 bps (0%)
```

## Endpoints

### Health Check
```
GET /health
```

Returns relayer status and balance.

### Relay Info
```
GET /info
```

Returns relayer address, fee, and minimum withdrawal amount.

### Submit Withdrawal
```
POST /relay
```

Submits a withdrawal transaction. Body:
```json
{
  "proof": "0x...",
  "publicInputs": ["merkleRoot", "nullifier", "recipient", "amount", "changeCommitment"]
}
```

## Frontend Configuration

Update `frontend/src/config.js` to point to your relayer:

```javascript
export const RELAYER_CONFIG = {
  enabled: true,
  url: 'https://your-relayer-domain.com', // or http://localhost:3001 for local
  feeBps: 0
};
```

## Production Deployment

For production:

1. Use HTTPS (required for browser requests)
2. Set up proper CORS if needed
3. Fund the relayer wallet with enough ETH for gas
4. Monitor the relayer balance
5. Consider adding rate limiting

## Security Notes

- The relayer private key should be kept secure
- The relayer only pays gas - it cannot steal funds
- All proof verification happens on-chain
- Invalid proofs are rejected before submission
