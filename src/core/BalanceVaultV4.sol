// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IVerifier.sol";
import "poseidon-solidity/PoseidonT3.sol";
import "poseidon-solidity/PoseidonT4.sol";

/**
 * @title BalanceVaultV4
 * @notice Privacy vault using efficient BN254 Poseidon (~13k gas per hash)
 * @dev Uses poseidon-solidity library for gas-efficient hashing.
 *      Total deposit gas: ~270k (20 hashes × 13.5k = 270k)
 *
 *      Field: BN254 (alt_bn128) - p = 21888242871839275222246405745257275088548364400416034343698204186575808495617
 *      This is the same field used by Tornado Cash, Semaphore, and other ZK protocols.
 */
contract BalanceVaultV4 is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ==================== CONSTANTS ====================

    IERC20 public immutable TOKEN;
    IVerifier public verifier;

    // BN254 field modulus
    uint256 public constant FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

    // Merkle tree parameters
    uint256 public constant TREE_DEPTH = 20;
    uint256 public constant MAX_NOTES = 2 ** TREE_DEPTH; // ~1M notes
    uint256 public constant ROOT_HISTORY_SIZE = 100;

    // Precomputed zeros for BN254 Poseidon
    // zeros[i] = hash(zeros[i-1], zeros[i-1]) where zeros[0] = 0
    uint256[21] private ZEROS;

    // ==================== STATE ====================

    mapping(uint256 => uint256) public filledSubtrees;
    mapping(uint256 => uint256) public roots;
    uint256 public currentRootIndex;
    uint256 public nextNoteIndex;

    // Nullifier tracking
    mapping(uint256 => bool) public nullifierUsed;
    mapping(uint256 => uint256) public noteCommitments;

    // Commitment tracking
    mapping(uint256 => bool) public commitmentUsed;

    bool private zerosInitialized;

    // ==================== EVENTS ====================

    event NoteCreated(
        uint256 indexed commitment,
        uint256 indexed noteIndex,
        uint256 timestamp
    );

    event Withdrawal(
        uint256 indexed nullifier,
        address indexed recipient,
        uint256 amount,
        bool hasChange
    );

    // ==================== ERRORS ====================

    error InvalidProof();
    error NullifierAlreadyUsed();
    error InvalidNoteIndex();
    error InvalidMerkleRoot();
    error TreeFull();
    error ZeroAmount();
    error CommitmentAlreadyUsed();
    error CommitmentNotInField();

    // ==================== CONSTRUCTOR ====================

    constructor(
        address _token,
        address _verifier
    ) Ownable(msg.sender) {
        TOKEN = IERC20(_token);
        verifier = IVerifier(_verifier);

        // Initialize zeros using BN254 Poseidon
        _initializeZeros();

        // Set initial root to empty tree root
        roots[0] = ZEROS[TREE_DEPTH];
    }

    function _initializeZeros() private {
        ZEROS[0] = 0;
        for (uint256 i = 1; i <= TREE_DEPTH; i++) {
            ZEROS[i] = PoseidonT3.hash([ZEROS[i-1], ZEROS[i-1]]);
        }
        zerosInitialized = true;
    }

    // ==================== DEPOSIT ====================

    /**
     * @notice Deposit tokens and create a note
     * @param commitment Poseidon commitment = hash(spendingKeyHash, balance, randomness)
     * @param amount Amount of tokens to deposit
     */
    function deposit(uint256 commitment, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (nextNoteIndex >= MAX_NOTES) revert TreeFull();
        if (commitmentUsed[commitment]) revert CommitmentAlreadyUsed();
        if (commitment >= FIELD_MODULUS) revert CommitmentNotInField();

        commitmentUsed[commitment] = true;
        TOKEN.safeTransferFrom(msg.sender, address(this), amount);

        uint256 noteIndex = nextNoteIndex;
        _insertNote(commitment);

        emit NoteCreated(commitment, noteIndex, block.timestamp);
    }

    // ==================== WITHDRAW ====================

    /**
     * @notice Withdraw tokens using a ZK proof
     * @param proof The SNARK/STARK proof
     * @param publicInputs [merkleRoot, nullifier, recipient, amount, changeCommitment]
     */
    function withdraw(
        bytes calldata proof,
        uint256[5] calldata publicInputs
    ) external nonReentrant {
        uint256 merkleRoot = publicInputs[0];
        uint256 nullifier = publicInputs[1];
        address recipient = address(uint160(publicInputs[2]));
        uint256 amount = publicInputs[3];
        uint256 changeCommitment = publicInputs[4];

        if (!isKnownRoot(merkleRoot)) revert InvalidMerkleRoot();
        if (nullifierUsed[nullifier]) revert NullifierAlreadyUsed();

        uint256[4] memory verifierInputs = [
            publicInputs[0],
            publicInputs[1],
            publicInputs[2],
            publicInputs[3]
        ];

        if (!verifier.verifyProof(proof, verifierInputs)) {
            revert InvalidProof();
        }

        nullifierUsed[nullifier] = true;

        // Handle change note
        bool hasChange = changeCommitment != 0;
        if (hasChange) {
            if (changeCommitment >= FIELD_MODULUS) revert CommitmentNotInField();
            if (commitmentUsed[changeCommitment]) revert CommitmentAlreadyUsed();
            commitmentUsed[changeCommitment] = true;
            _insertNote(changeCommitment);
            emit NoteCreated(changeCommitment, nextNoteIndex - 1, block.timestamp);
        }

        TOKEN.safeTransfer(recipient, amount);

        emit Withdrawal(nullifier, recipient, amount, hasChange);
    }

    // ==================== MERKLE TREE ====================

    function _zeros(uint256 level) internal view returns (uint256) {
        return ZEROS[level];
    }

    function _insertNote(uint256 commitment) internal {
        uint256 noteIndex = nextNoteIndex;
        if (noteIndex >= MAX_NOTES) revert TreeFull();

        noteCommitments[noteIndex] = commitment;

        uint256 currentHash = commitment;
        uint256 currentIndex = noteIndex;

        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            if (currentIndex % 2 == 0) {
                filledSubtrees[i] = currentHash;
                currentHash = PoseidonT3.hash([currentHash, _zeros(i)]);
            } else {
                currentHash = PoseidonT3.hash([filledSubtrees[i], currentHash]);
            }
            currentIndex /= 2;
        }

        currentRootIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
        roots[currentRootIndex] = currentHash;
        nextNoteIndex++;
    }

    // ==================== VIEW FUNCTIONS ====================

    function isKnownRoot(uint256 root) public view returns (bool) {
        if (root == 0) return false;
        for (uint256 i = 0; i < ROOT_HISTORY_SIZE; i++) {
            if (roots[i] == root) return true;
        }
        return false;
    }

    function getCurrentRoot() external view returns (uint256) {
        return roots[currentRootIndex];
    }

    function getNoteCount() external view returns (uint256) {
        return nextNoteIndex;
    }

    function getZero(uint256 level) external view returns (uint256) {
        require(level <= TREE_DEPTH, "Level too high");
        return ZEROS[level];
    }

    function getMerkleProof(uint256 noteIndex) external view returns (
        uint256[] memory siblings,
        bool[] memory isLeft
    ) {
        if (noteIndex >= nextNoteIndex) revert InvalidNoteIndex();

        siblings = new uint256[](TREE_DEPTH);
        isLeft = new bool[](TREE_DEPTH);
        uint256 currentIndex = noteIndex;

        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            isLeft[i] = (currentIndex % 2 == 0);
            if (currentIndex % 2 == 0) {
                uint256 siblingIndex = currentIndex + 1;
                siblings[i] = siblingIndex < nextNoteIndex
                    ? noteCommitments[siblingIndex]
                    : _zeros(i);
            } else {
                siblings[i] = noteCommitments[currentIndex - 1];
            }
            currentIndex /= 2;
        }
    }

    /**
     * @notice Compute commitment off-chain helper
     * @dev commitment = Poseidon(spendingKeyHash, balance, randomness)
     */
    function computeCommitment(
        uint256 spendingKeyHash,
        uint256 balance,
        uint256 randomness
    ) external pure returns (uint256) {
        return PoseidonT4.hash([spendingKeyHash, balance, randomness]);
    }

    /**
     * @notice Compute nullifier off-chain helper
     * @dev nullifier = Poseidon(spendingKey, noteIndex)
     */
    function computeNullifier(
        uint256 spendingKey,
        uint256 noteIndex
    ) external pure returns (uint256) {
        return PoseidonT3.hash([spendingKey, noteIndex]);
    }

    /**
     * @notice Hash two values (for Merkle tree)
     */
    function hashPair(uint256 left, uint256 right) external pure returns (uint256) {
        return PoseidonT3.hash([left, right]);
    }

    // ==================== ADMIN ====================

    function setVerifier(address _verifier) external onlyOwner {
        verifier = IVerifier(_verifier);
    }
}
