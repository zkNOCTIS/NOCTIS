// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";

contract VerifierMemoryTest is Test {
    function testMemoryLayout() public pure {
        uint256[8] memory proof;
        proof[0] = 111;
        proof[1] = 222;
        proof[2] = 333;
        proof[3] = 444;
        
        uint256 val0;
        uint256 val1;
        uint256 val2;
        
        assembly {
            val0 := mload(proof)
            val1 := mload(add(proof, 32))
            val2 := mload(add(proof, 64))
        }
        
        console.log("proof[0]:", proof[0]);
        console.log("val0 (mload(proof)):", val0);
        console.log("val1 (mload(proof+32)):", val1);
        console.log("val2 (mload(proof+64)):", val2);
        
        assertEq(val0, 111, "mload(proof) should be proof[0]");
        assertEq(val1, 222, "mload(proof+32) should be proof[1]");
    }
}
