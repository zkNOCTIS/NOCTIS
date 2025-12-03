// NOCTIS Contract Addresses
// Update these after deploying to your target network

export const ADDRESSES = {
  token: "0x0000000000000000000000000000000000000000",      // Your ERC20 token
  vault: "0x0000000000000000000000000000000000000000",      // BalanceVaultV4
  verifier: "0x0000000000000000000000000000000000000000",   // WithdrawalVerifier (Groth16)
  poseidonT3: "0x0000000000000000000000000000000000000000", // PoseidonT3 library
  poseidonT4: "0x0000000000000000000000000000000000000000"  // PoseidonT4 library
};

// Chain Configuration - Update for your target network
export const CHAIN_CONFIG = {
  chainId: 8453,           // Base Mainnet: 8453, Base Sepolia: 84532
  chainIdHex: '0x2105',    // Base Mainnet: 0x2105, Base Sepolia: 0x14a34
  name: 'Base',
  rpcUrl: 'https://mainnet.base.org',
  blockExplorer: 'https://basescan.org',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18
  }
};

// Legacy export for compatibility
export const BASE_SEPOLIA = CHAIN_CONFIG;

// Vault ABI
export const VAULT_ABI = [
  "function deposit(uint256 commitment, uint256 amount) external",
  "function withdraw(bytes calldata proof, uint256[5] calldata publicInputs) external",
  "function getCurrentRoot() external view returns (uint256)",
  "function getMerkleProof(uint256 noteIndex) external view returns (uint256[] memory siblings, bool[] memory isLeft)",
  "function getNoteCount() external view returns (uint256)",
  "function isKnownRoot(uint256 root) external view returns (bool)",
  "function nullifierUsed(uint256 nullifier) external view returns (bool)",
  "function commitmentUsed(uint256 commitment) external view returns (bool)",
  "function computeCommitment(uint256 spendingKeyHash, uint256 balance, uint256 randomness) external view returns (uint256)",
  "function computeNullifier(uint256 spendingKey, uint256 noteIndex) external view returns (uint256)",
  "function getPoseidonLib() external view returns (address)",
  "event NoteCreated(uint256 indexed commitment, uint256 indexed noteIndex, uint256 timestamp)",
  "event Withdrawal(uint256 indexed nullifier, address indexed recipient, uint256 amount, bool hasChange)"
];

// Token ABI (standard ERC20)
export const TOKEN_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)"
];

// BN254 field modulus
export const FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
