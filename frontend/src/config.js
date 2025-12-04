// Shadow ETH - Private ETH Vault Configuration
// For eth.zknoctis.com

// Contract Addresses
export const ADDRESSES = {
  vault: "0x05D1cc939b2F8528eF5b7d9C09A653a9119d28f5", // EthVaultV1 on Base mainnet
};

// Base Mainnet
export const BASE_MAINNET = {
  chainId: 8453,
  chainIdHex: '0x2105',
  name: 'Base',
  rpcUrl: 'https://base-rpc.publicnode.com',
  blockExplorer: 'https://basescan.org',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18
  }
};

// Localhost (Anvil) - for local testing
export const LOCALHOST = {
  chainId: 31337,
  chainIdHex: '0x7a69',
  name: 'Localhost',
  rpcUrl: 'http://localhost:8545',
  blockExplorer: '',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18
  }
};

// Active network - SET TO BASE_MAINNET FOR PRODUCTION
export const ACTIVE_NETWORK = BASE_MAINNET;

// Fee configuration
export const FEE_BPS = 50n; // 0.5% deposit fee (no fee on withdrawals)

// Relayer configuration (for privacy-preserving withdrawals)
const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const RELAYER_CONFIG = {
  enabled: true, // Enable relayer for private withdrawals
  url: isLocalhost ? 'http://localhost:3001' : '/relayer',
  feeBps: 0
};

// ETH Vault ABI (native ETH, payable deposit)
export const VAULT_ABI = [
  "function deposit(uint256 commitment) external payable",
  "function withdraw(bytes calldata proof, uint256[5] calldata publicInputs) external",
  "function getCurrentRoot() external view returns (uint256)",
  "function getMerkleProof(uint256 noteIndex) external view returns (uint256[] memory siblings, bool[] memory isLeft)",
  "function getNoteCount() external view returns (uint256)",
  "function isKnownRoot(uint256 root) external view returns (bool)",
  "function nullifierUsed(uint256 nullifier) external view returns (bool)",
  "function commitmentUsed(uint256 commitment) external view returns (bool)",
  "function feeBps() external view returns (uint256)",
  "function feeRecipient() external view returns (address)",
  "event NoteCreated(uint256 indexed commitment, uint256 indexed noteIndex, uint256 timestamp)",
  "event Withdrawal(uint256 indexed nullifier, address indexed recipient, uint256 amount, bool hasChange)"
];

// BN254 field modulus
export const FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
