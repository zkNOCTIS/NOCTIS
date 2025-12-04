// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/core/EthVaultV1.sol";
import "../src/core/IVerifier.sol";

contract MockVerifier is IVerifier {
    bool public shouldPass = true;

    function setResult(bool _pass) external {
        shouldPass = _pass;
    }

    function verifyProof(bytes calldata, uint256[4] calldata) external view returns (bool) {
        return shouldPass;
    }
}

contract EthVaultV1Test is Test {
    EthVaultV1 public vault;
    MockVerifier public verifier;
    address public feeRecipient;
    address public user;

    function setUp() public {
        verifier = new MockVerifier();
        feeRecipient = makeAddr("feeRecipient");
        user = makeAddr("user");

        vault = new EthVaultV1(address(verifier), feeRecipient);

        // Fund user with ETH
        vm.deal(user, 100 ether);
    }

    function test_DepositFeeCalculation() public {
        uint256 depositAmount = 1 ether;
        uint256 expectedFee = (depositAmount * 50) / 10000; // 0.5% = 0.005 ETH

        uint256 feeRecipientBalanceBefore = feeRecipient.balance;
        uint256 vaultBalanceBefore = address(vault).balance;

        // Create a valid commitment (just a random number < FIELD_MODULUS)
        uint256 commitment = 12345678901234567890;

        vm.prank(user);
        vault.deposit{value: depositAmount}(commitment);

        // Check fee was sent to recipient
        assertEq(feeRecipient.balance - feeRecipientBalanceBefore, expectedFee, "Fee not correct");

        // Check vault received deposit minus fee
        assertEq(address(vault).balance - vaultBalanceBefore, depositAmount - expectedFee, "Vault balance not correct");
    }

    function test_DepositFeePercentages() public {
        // Test various deposit amounts
        uint256[] memory amounts = new uint256[](4);
        amounts[0] = 0.1 ether;
        amounts[1] = 1 ether;
        amounts[2] = 10 ether;
        amounts[3] = 50 ether;

        for (uint256 i = 0; i < amounts.length; i++) {
            uint256 amount = amounts[i];
            uint256 expectedFee = (amount * 50) / 10000;

            uint256 feeRecipientBefore = feeRecipient.balance;
            uint256 commitment = 100 + i; // unique commitment for each deposit

            vm.prank(user);
            vault.deposit{value: amount}(commitment);

            uint256 actualFee = feeRecipient.balance - feeRecipientBefore;
            assertEq(actualFee, expectedFee, "Fee incorrect for amount");
        }
    }

    function test_ZeroDepositReverts() public {
        uint256 commitment = 99999;

        vm.prank(user);
        vm.expectRevert(EthVaultV1.ZeroAmount.selector);
        vault.deposit{value: 0}(commitment);
    }

    function test_DuplicateCommitmentReverts() public {
        uint256 commitment = 11111;

        vm.prank(user);
        vault.deposit{value: 1 ether}(commitment);

        vm.prank(user);
        vm.expectRevert(EthVaultV1.CommitmentAlreadyUsed.selector);
        vault.deposit{value: 1 ether}(commitment);
    }

    function test_NoteCreatedEvent() public {
        uint256 commitment = 22222;

        vm.prank(user);
        vm.expectEmit(true, true, false, true);
        emit EthVaultV1.NoteCreated(commitment, 0, block.timestamp);
        vault.deposit{value: 1 ether}(commitment);
    }

    function test_MerkleRootUpdated() public {
        uint256 initialRoot = vault.getCurrentRoot();

        uint256 commitment = 33333;
        vm.prank(user);
        vault.deposit{value: 1 ether}(commitment);

        uint256 newRoot = vault.getCurrentRoot();
        assertTrue(newRoot != initialRoot, "Root should change after deposit");
    }

    function test_NoteCountIncremented() public {
        assertEq(vault.getNoteCount(), 0, "Should start at 0");

        vm.prank(user);
        vault.deposit{value: 1 ether}(44444);
        assertEq(vault.getNoteCount(), 1, "Should be 1 after deposit");

        vm.prank(user);
        vault.deposit{value: 1 ether}(44445);
        assertEq(vault.getNoteCount(), 2, "Should be 2 after second deposit");
    }

    function test_SetFeeBps() public {
        assertEq(vault.feeBps(), 50, "Initial fee should be 50 bps");

        vault.setFeeBps(100); // 1%
        assertEq(vault.feeBps(), 100, "Fee should be updated");

        // Test max fee (10%)
        vault.setFeeBps(1000);
        assertEq(vault.feeBps(), 1000, "Max fee should work");

        // Test above max reverts
        vm.expectRevert("Fee too high");
        vault.setFeeBps(1001);
    }

    function test_SetFeeRecipient() public {
        address newRecipient = makeAddr("newRecipient");

        vault.setFeeRecipient(newRecipient);
        assertEq(vault.feeRecipient(), newRecipient, "Fee recipient should be updated");
    }

    function test_OnlyOwnerCanSetFee() public {
        vm.prank(user);
        vm.expectRevert();
        vault.setFeeBps(100);
    }

    function test_SmallDepositFeeRounding() public {
        // Test very small deposit where fee might round to 0
        uint256 smallDeposit = 100 wei; // 0.5% of 100 = 0.5, rounds down to 0
        uint256 expectedFee = (smallDeposit * 50) / 10000; // = 0

        uint256 feeRecipientBefore = feeRecipient.balance;
        uint256 commitment = 55555;

        vm.prank(user);
        vault.deposit{value: smallDeposit}(commitment);

        // Fee should be 0 for very small amounts
        assertEq(feeRecipient.balance - feeRecipientBefore, expectedFee, "Small deposit fee incorrect");
    }
}
