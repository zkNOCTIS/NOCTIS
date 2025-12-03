/**
 * NOCTIS SDK Test Suite
 *
 * Tests SDK functionality against deployed Base Sepolia contracts.
 * Run with: node test-sdk.js
 */

const { ethers } = require('ethers');
const {
    NoctisSDK,
    NoctisWallet,
    Note,
    generateSpendingKey,
    generateRandomness,
    computeCommitment,
    computeNullifier,
    ADDRESSES
} = require('./noctis-sdk');

// Base Sepolia RPC
const RPC_URL = 'https://sepolia.base.org';

let passCount = 0;
let failCount = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
        passCount++;
    } catch (err) {
        console.log(`✗ ${name}`);
        console.log(`  Error: ${err.message}`);
        failCount++;
    }
}

async function testAsync(name, fn) {
    try {
        await fn();
        console.log(`✓ ${name}`);
        passCount++;
    } catch (err) {
        console.log(`✗ ${name}`);
        console.log(`  Error: ${err.message}`);
        failCount++;
    }
}

function assertEqual(actual, expected, msg) {
    if (actual !== expected) {
        throw new Error(`${msg}: expected ${expected}, got ${actual}`);
    }
}

function assertTrue(value, msg) {
    if (!value) {
        throw new Error(`${msg}: expected true, got ${value}`);
    }
}

async function main() {
    console.log('\n=== NOCTIS SDK Test Suite ===\n');

    // ==================== UTILITY TESTS ====================

    console.log('--- Utility Functions ---\n');

    test('generateSpendingKey returns 66 char hex string', () => {
        const key = generateSpendingKey();
        assertTrue(key.startsWith('0x'), 'should start with 0x');
        assertEqual(key.length, 66, 'key length');
    });

    test('generateRandomness returns 66 char hex string', () => {
        const rand = generateRandomness();
        assertTrue(rand.startsWith('0x'), 'should start with 0x');
        assertEqual(rand.length, 66, 'randomness length');
    });

    test('computeCommitment returns valid hash', () => {
        const key = generateSpendingKey();
        const balance = 10000n;
        const rand = generateRandomness();
        const commitment = computeCommitment(key, balance, rand);
        assertTrue(commitment.startsWith('0x'), 'should start with 0x');
        assertEqual(commitment.length, 66, 'commitment length');
    });

    test('computeNullifier returns valid hash', () => {
        const key = generateSpendingKey();
        const nullifier = computeNullifier(key, 5);
        assertTrue(nullifier.startsWith('0x'), 'should start with 0x');
        assertEqual(nullifier.length, 66, 'nullifier length');
    });

    test('different inputs produce different commitments', () => {
        const key = generateSpendingKey();
        const rand1 = generateRandomness();
        const rand2 = generateRandomness();
        const c1 = computeCommitment(key, 10000n, rand1);
        const c2 = computeCommitment(key, 10000n, rand2);
        assertTrue(c1 !== c2, 'commitments should differ');
    });

    // ==================== NOTE TESTS ====================

    console.log('\n--- Note Class ---\n');

    test('Note.create generates valid note', () => {
        const note = Note.create(10000n);
        assertTrue(note.spendingKey !== undefined, 'has spending key');
        assertEqual(note.balance, 10000n, 'balance');
        assertTrue(note.randomness !== undefined, 'has randomness');
        assertTrue(note.commitment !== undefined, 'has commitment');
        assertEqual(note.noteIndex, null, 'noteIndex should be null');
    });

    test('Note serialization roundtrip', () => {
        const note = Note.create(50000n);
        note.noteIndex = 42;
        const json = note.toJSON();
        const restored = Note.fromJSON(json);
        assertEqual(restored.spendingKey, note.spendingKey, 'spending key');
        assertEqual(restored.balance, note.balance, 'balance');
        assertEqual(restored.randomness, note.randomness, 'randomness');
        assertEqual(restored.noteIndex, note.noteIndex, 'noteIndex');
        assertEqual(restored.commitment, note.commitment, 'commitment');
    });

    test('Note.getNullifier returns null without noteIndex', () => {
        const note = Note.create(10000n);
        assertEqual(note.getNullifier(), null, 'nullifier should be null');
    });

    test('Note.getNullifier returns hash with noteIndex', () => {
        const note = Note.create(10000n);
        note.noteIndex = 5;
        const nullifier = note.getNullifier();
        assertTrue(nullifier !== null, 'nullifier should exist');
        assertEqual(nullifier.length, 66, 'nullifier length');
    });

    // ==================== WALLET TESTS ====================

    console.log('\n--- Wallet Class ---\n');

    test('NoctisWallet starts empty', () => {
        const wallet = new NoctisWallet();
        assertEqual(wallet.getTotalBalance(), 0n, 'balance');
        assertEqual(wallet.notes.length, 0, 'notes count');
    });

    test('NoctisWallet tracks notes', () => {
        const wallet = new NoctisWallet();
        const note1 = Note.create(10000n);
        const note2 = Note.create(20000n);
        wallet.addNote(note1);
        wallet.addNote(note2);
        assertEqual(wallet.getTotalBalance(), 30000n, 'total balance');
        assertEqual(wallet.notes.length, 2, 'notes count');
    });

    test('NoctisWallet finds note by commitment', () => {
        const wallet = new NoctisWallet();
        const note = Note.create(10000n);
        wallet.addNote(note);
        const found = wallet.findNote(note.commitment);
        assertEqual(found.commitment, note.commitment, 'found note');
    });

    test('NoctisWallet removes notes', () => {
        const wallet = new NoctisWallet();
        const note = Note.create(10000n);
        wallet.addNote(note);
        wallet.removeNote(note.commitment);
        assertEqual(wallet.notes.length, 0, 'notes removed');
    });

    test('NoctisWallet export/import', () => {
        const wallet = new NoctisWallet();
        wallet.addNote(Note.create(10000n));
        wallet.addNote(Note.create(20000n));

        const exported = wallet.export();
        const imported = NoctisWallet.import(exported);

        assertEqual(imported.getTotalBalance(), 30000n, 'balance preserved');
        assertEqual(imported.notes.length, 2, 'notes preserved');
    });

    // ==================== SDK TESTS ====================

    console.log('\n--- SDK (Live Contract Tests) ---\n');

    const provider = new ethers.JsonRpcProvider(RPC_URL);

    await testAsync('SDK connects to Base Sepolia', async () => {
        const sdk = new NoctisSDK(provider);
        assertTrue(sdk.vault !== undefined, 'vault contract');
        assertTrue(sdk.token !== undefined, 'token contract');
    });

    await testAsync('SDK gets current root', async () => {
        const sdk = new NoctisSDK(provider);
        const root = await sdk.getCurrentRoot();
        assertTrue(root !== undefined, 'root exists');
        assertEqual(root.length, 66, 'root length');
    });

    await testAsync('SDK gets note count', async () => {
        const sdk = new NoctisSDK(provider);
        const count = await sdk.getNoteCount();
        assertTrue(count >= 0, 'count is valid');
    });

    await testAsync('SDK checks nullifier status', async () => {
        const sdk = new NoctisSDK(provider);
        const fakeNullifier = ethers.keccak256(ethers.toUtf8Bytes('fake'));
        const used = await sdk.isNullifierUsed(fakeNullifier);
        assertEqual(used, false, 'fake nullifier not used');
    });

    await testAsync('SDK generates valid proof structure', async () => {
        const sdk = new NoctisSDK(provider);
        const note = Note.create(ethers.parseEther('10000'));
        note.noteIndex = 0;

        const recipient = '0x1234567890123456789012345678901234567890';
        const amount = ethers.parseEther('5000');

        const { proof, publicInputs } = await sdk.generateProof(note, recipient, amount);

        // Check proof structure
        assertTrue(proof.length >= 96, 'proof has commitments');
        assertEqual(publicInputs.length, 5, 'has 5 public inputs');
    });

    await testAsync('SDK rejects overdraw', async () => {
        const sdk = new NoctisSDK(provider);
        const note = Note.create(ethers.parseEther('100'));
        note.noteIndex = 0;

        try {
            await sdk.generateProof(
                note,
                '0x1234567890123456789012345678901234567890',
                ethers.parseEther('200') // More than balance
            );
            throw new Error('Should have thrown');
        } catch (err) {
            assertTrue(err.message.includes('Insufficient balance'), 'correct error');
        }
    });

    // ==================== RESULTS ====================

    console.log('\n=== Test Results ===\n');
    console.log(`Passed: ${passCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`Total:  ${passCount + failCount}`);

    if (failCount > 0) {
        console.log('\n⚠️  Some tests failed!\n');
        process.exit(1);
    } else {
        console.log('\n✓ All tests passed!\n');
    }
}

main().catch(err => {
    console.error('Test suite error:', err);
    process.exit(1);
});
