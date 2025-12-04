// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IVerifier.sol";
import "poseidon-solidity/PoseidonT3.sol";
import "poseidon-solidity/PoseidonT4.sol";

/**
 * @title EthVaultV1
 * @notice Privacy vault for ETH with 0.5% fee on deposit
 * @dev Uses same ZK circuit as BalanceVaultV4, but handles native ETH
 */
contract EthVaultV1 is ReentrancyGuard, Ownable {

    // ==================== CONSTANTS ====================

    IVerifier public verifier;

    // BN254 field modulus
    uint256 public constant FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

    // Merkle tree parameters
    uint256 public constant TREE_DEPTH = 20;
    uint256 public constant MAX_NOTES = 2 ** TREE_DEPTH;
    uint256 public constant ROOT_HISTORY_SIZE = 100;

    // Precomputed zeros for BN254 Poseidon
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

    // Fee configuration (0.5% = 50 basis points)
    uint256 public feeBps = 50;   // Fee in basis points (50 = 0.5%)
    address public feeRecipient;  // Where fees go

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

    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);

    // ==================== ERRORS ====================

    error InvalidProof();
    error NullifierAlreadyUsed();
    error InvalidNoteIndex();
    error InvalidMerkleRoot();
    error TreeFull();
    error ZeroAmount();
    error CommitmentAlreadyUsed();
    error CommitmentNotInField();
    error EthTransferFailed();

    // ==================== CONSTRUCTOR ====================

    constructor(
        address _verifier,
        address _feeRecipient
    ) Ownable(msg.sender) {
        verifier = IVerifier(_verifier);
        feeRecipient = _feeRecipient;

        _initializeZeros();
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
     * @notice Deposit ETH and create a note, 0.5% fee taken from deposit
     * @param commitment Poseidon commitment = hash(spendingKeyHash, balance, randomness)
     */
    function deposit(uint256 commitment) external payable nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        if (nextNoteIndex >= MAX_NOTES) revert TreeFull();
        if (commitmentUsed[commitment]) revert CommitmentAlreadyUsed();
        if (commitment >= FIELD_MODULUS) revert CommitmentNotInField();

        // Calculate and collect fee (0.5% = 50 bps)
        uint256 fee = (msg.value * feeBps) / 10000;

        if (fee > 0) {
            (bool feeSuccess, ) = feeRecipient.call{value: fee}("");
            if (!feeSuccess) revert EthTransferFailed();
        }

        commitmentUsed[commitment] = true;

        uint256 noteIndex = nextNoteIndex;
        _insertNote(commitment);

        emit NoteCreated(commitment, noteIndex, block.timestamp);
    }

    // ==================== WITHDRAW ====================

    /**
     * @notice Withdraw ETH using a ZK proof, paying NOCTIS fee
     * @param proof The SNARK proof
     * @param publicInputs [merkleRoot, nullifier, recipient, amount, changeCommitment]
     * @dev Caller must have approved NOCTIS for fee payment
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
        if (changeCommitment != 0) {
            if (changeCommitment >= FIELD_MODULUS) revert CommitmentNotInField();
            if (commitmentUsed[changeCommitment]) revert CommitmentAlreadyUsed();
            commitmentUsed[changeCommitment] = true;
            _insertNote(changeCommitment);
            emit NoteCreated(changeCommitment, nextNoteIndex - 1, block.timestamp);
        }

        // Send ETH to recipient
        (bool success, ) = recipient.call{value: amount}("");
        if (!success) revert EthTransferFailed();

        bool hasChange = changeCommitment != 0;
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

    function computeCommitment(
        uint256 spendingKeyHash,
        uint256 balance,
        uint256 randomness
    ) external pure returns (uint256) {
        return PoseidonT4.hash([spendingKeyHash, balance, randomness]);
    }

    function computeNullifier(
        uint256 spendingKey,
        uint256 noteIndex
    ) external pure returns (uint256) {
        return PoseidonT3.hash([spendingKey, noteIndex]);
    }

    function hashPair(uint256 left, uint256 right) external pure returns (uint256) {
        return PoseidonT3.hash([left, right]);
    }

    // ==================== ADMIN ====================

    function setVerifier(address _verifier) external onlyOwner {
        verifier = IVerifier(_verifier);
    }

    function setFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 1000, "Fee too high"); // Max 10%
        emit FeeUpdated(feeBps, _feeBps);
        feeBps = _feeBps;
    }

    function setFeeRecipient(address _recipient) external onlyOwner {
        emit FeeRecipientUpdated(feeRecipient, _recipient);
        feeRecipient = _recipient;
    }

    // Allow contract to receive ETH
    receive() external payable {}
}
