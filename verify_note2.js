const { buildPoseidon } = require('circomlibjs');

async function main() {
  const poseidon = await buildPoseidon();
  
  const spendingKey = "739687949354288662934120678802664238479213643757161742868491514386759180214";
  const balance = "10000000000000000000000";
  const randomness = "15452082865046378248463020357029932622161351309712061910763578872837659578944";
  const noteIndex = "45";
  
  // Compute spendingKeyHash = hash(spendingKey, 0) - TWO inputs!
  const spendingKeyHash = poseidon.F.toString(poseidon([BigInt(spendingKey), 0n]));
  console.log('spendingKeyHash:', spendingKeyHash);
  
  // Compute commitment = hash(spendingKeyHash, balance, randomness) - THREE inputs!
  const commitment = poseidon.F.toString(poseidon([
    BigInt(spendingKeyHash),
    BigInt(balance),
    BigInt(randomness)
  ]));
  console.log('Computed commitment:', commitment);
  console.log('Stored commitment:  ', '15917946456033457652290494508271968394646337477397935717085062754648928991862');
  console.log('Match:', commitment === '15917946456033457652290494508271968394646337477397935717085062754648928991862');
  
  // Compute nullifier = hash(spendingKey, noteIndex)
  const nullifier = poseidon.F.toString(poseidon([BigInt(spendingKey), BigInt(noteIndex)]));
  console.log('\nComputed nullifier:', nullifier);
}

main().catch(console.error);
