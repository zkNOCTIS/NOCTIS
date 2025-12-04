const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
const VAULT_ADDRESS = '0x441F619ff56d516474b3e0c1608eeA44a3a6E486';

const VAULT_ABI = [
  "function noteCommitments(uint256) view returns (uint256)",
  "function getNoteCount() view returns (uint256)",
  "function getCurrentRoot() view returns (uint256)"
];

async function main() {
  const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider);
  
  const noteCount = await vault.getNoteCount();
  console.log('Total notes in tree:', noteCount.toString());
  
  const currentRoot = await vault.getCurrentRoot();
  console.log('Current merkle root:', currentRoot.toString());
  
  // Check note #45
  if (noteCount > 45n) {
    const note45 = await vault.noteCommitments(45);
    console.log('Note #45 commitment:', note45.toString());
  } else {
    console.log('Note #45 does not exist on chain!');
  }
  
  // List recent notes
  console.log('\nRecent notes:');
  const start = Math.max(0, Number(noteCount) - 5);
  for (let i = start; i < Number(noteCount); i++) {
    const commitment = await vault.noteCommitments(i);
    console.log(`  Note #${i}: ${commitment.toString()}`);
  }
}

main().catch(console.error);
