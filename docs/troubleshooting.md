# Troubleshooting

## Common Issues

### "Insufficient balance" error

**Cause**: The token address might have a checksum issue, or you don't have enough NOCTIS.

**Solution**:
1. Check your NOCTIS balance in your wallet
2. Make sure you're connected to Base network
3. Try refreshing the page

---

### "Buffer is not defined" error

**Cause**: Browser compatibility issue with cryptographic libraries.

**Solution**:
1. Try a different browser (Chrome recommended)
2. Clear browser cache and refresh
3. Disable browser extensions that might interfere

---

### Note not appearing after deposit

**Cause**: The note might not have been saved due to a browser issue.

**Solution**:
1. Check the transaction on BaseScan
2. If the deposit succeeded, the note should be in localStorage
3. Try refreshing the page
4. Check browser console for errors

**Prevention**: Always copy your note immediately after deposit confirmation.

---

### "NullifierAlreadyUsed" error

**Cause**: You're trying to spend a note that's already been spent.

**Solution**:
- This note has already been withdrawn
- Check your "Spent Notes" section
- If you did a partial withdrawal, use the new change note instead

---

### Proof generation taking too long

**Cause**: ZK proof generation is computationally intensive.

**Solution**:
- Wait 10-30 seconds - this is normal
- Don't close the browser tab
- Use a device with more processing power
- Close other browser tabs to free up memory

---

### Wallet not connecting

**Cause**: Wallet extension issue or wrong network.

**Solution**:
1. Make sure MetaMask/wallet is unlocked
2. Switch to Base network
3. Try disconnecting and reconnecting
4. Refresh the page

---

### Transaction failing

**Cause**: Could be gas issues, network congestion, or contract errors.

**Solution**:
1. Check you have enough ETH for gas
2. Try increasing gas limit
3. Wait and retry if network is congested
4. Check the error message in your wallet

---

## Getting Help

If you're still having issues:

1. Check the [FAQ](faq.md)
2. Join our [Twitter](https://twitter.com/zknoctis) for updates
3. Open an issue on [GitHub](https://github.com/zkNOCTIS/NOCTIS)
