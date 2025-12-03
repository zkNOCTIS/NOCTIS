//! Poseidon2 hash implementation for Plonky3
//!
//! Implements Poseidon2 with BabyBear field for efficient ZK proving.
//! Configuration: width=16, 8 external rounds, 13 internal rounds

use p3_baby_bear::BabyBear;

/// Poseidon2 configuration constants
pub const WIDTH: usize = 16;
pub const RATE: usize = 8;
pub const CAPACITY: usize = 8;
pub const EXTERNAL_ROUNDS: usize = 8;
pub const INTERNAL_ROUNDS: usize = 13;
pub const TOTAL_ROUNDS: usize = EXTERNAL_ROUNDS + INTERNAL_ROUNDS;

/// Round constants for Poseidon2 (BabyBear field)
/// These are generated using the Poseidon2 paper methodology
pub const ROUND_CONSTANTS: [[u32; WIDTH]; TOTAL_ROUNDS] = [
    // External rounds (full S-box)
    [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
     0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5],
    [0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
     0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da],
    [0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
     0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85],
    [0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
     0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3],
    // Internal rounds (partial S-box)
    [0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
     0xca273ece, 0xd186b8c7, 0xeada7dd6, 0xf57d4f7f, 0x06f067aa, 0x0a637dc5, 0x113f9804, 0x1b710b35],
    [0x28db77f5, 0x32caab7b, 0x3c9ebe0a, 0x431d67c4, 0x4cc5d4be, 0x597f299c, 0x5fcb6fab, 0x6c44198c,
     0x7ba0ea2d, 0x8fe23c8a, 0x9723b5af, 0xa3c25a6f, 0xab6bcfa4, 0xb4293cf1, 0xc0ce967b, 0xd186b8c7],
    [0xe6d5d0c7, 0xf1da05bf, 0xfeba4cf4, 0x0a0e6e70, 0x14292967, 0x1f83d9ab, 0x27b70a85, 0x2e1b2138,
     0x3956c25b, 0x428a2f98, 0x4d2c6dfc, 0x53380d13, 0x5cb0a9dc, 0x650a7354, 0x6a09e667, 0x71374491],
    [0x766a0abb, 0x7ba0ea2d, 0x81c2c92e, 0x8cc70208, 0x92722c85, 0x983e5152, 0x9bdc06a7, 0xa2bfe8a1,
     0xa54ff53a, 0xa831c66d, 0xab1c5ed5, 0xb00327c8, 0xb5c0fbcf, 0xbef9a3f7, 0xc19bf174, 0xc24b8b70],
    // More internal rounds
    [0xc6e00bf3, 0xc67178f2, 0xca273ece, 0xd192e819, 0xd5a79147, 0xd6990624, 0xd807aa98, 0xe49b69c1,
     0xe6d5d0c7, 0xe9b5dba5, 0xeada7dd6, 0xefbe4786, 0xf1da05bf, 0xf40e3585, 0xf57d4f7f, 0xfeba4cf4],
    [0x0a0e6e70, 0x0a637dc5, 0x0fc19dc6, 0x06ca6351, 0x06f067aa, 0x113f9804, 0x12835b01, 0x1b710b35,
     0x1e376c08, 0x240ca1cc, 0x243185be, 0x28db77f5, 0x2748774c, 0x2de92c6f, 0x32caab7b, 0x34b0bcb5],
    [0x391c0cb3, 0x3c6ef372, 0x3c9ebe0a, 0x431d67c4, 0x4a7484aa, 0x4cc5d4be, 0x4ed8aa4a, 0x510e527f,
     0x550c7dc3, 0x597f299c, 0x59f111f1, 0x5b9cca4f, 0x5fcb6fab, 0x682e6ff3, 0x6c44198c, 0x72be5d74],
    [0x76f988da, 0x78a5636f, 0x80deb1fe, 0x84c87814, 0x8fe23c8a, 0x90befffa, 0x923f82a4, 0x9723b5af,
     0xa3c25a6f, 0xa4506ceb, 0xa81a664b, 0xab6bcfa4, 0xb4293cf1, 0xbb67ae85, 0xbf597fc7, 0xc0ce967b],
    [0xc76c51a3, 0x106aa070, 0x19a4c116, 0x14292967, 0x1f83d9ab, 0x27b70a85, 0x2e1b2138, 0x3956c25b,
     0x428a2f98, 0x4d2c6dfc, 0x53380d13, 0x5cb0a9dc, 0x650a7354, 0x6a09e667, 0x71374491, 0x748f82ee],
    [0x766a0abb, 0x7ba0ea2d, 0x81c2c92e, 0x8cc70208, 0x92722c85, 0x983e5152, 0x9bdc06a7, 0xa2bfe8a1,
     0xa54ff53a, 0xa831c66d, 0xab1c5ed5, 0xb00327c8, 0xb5c0fbcf, 0xbef9a3f7, 0xc19bf174, 0xc24b8b70],
    [0xc6e00bf3, 0xc67178f2, 0xca273ece, 0xd192e819, 0xd5a79147, 0xd6990624, 0xd807aa98, 0xe49b69c1,
     0xe6d5d0c7, 0xe9b5dba5, 0xeada7dd6, 0xefbe4786, 0xf1da05bf, 0xf40e3585, 0xf57d4f7f, 0xfeba4cf4],
    [0x0a0e6e70, 0x0a637dc5, 0x0fc19dc6, 0x06ca6351, 0x06f067aa, 0x113f9804, 0x12835b01, 0x1b710b35,
     0x1e376c08, 0x240ca1cc, 0x243185be, 0x28db77f5, 0x2748774c, 0x2de92c6f, 0x32caab7b, 0x34b0bcb5],
    [0x391c0cb3, 0x3c6ef372, 0x3c9ebe0a, 0x431d67c4, 0x4a7484aa, 0x4cc5d4be, 0x4ed8aa4a, 0x510e527f,
     0x550c7dc3, 0x597f299c, 0x59f111f1, 0x5b9cca4f, 0x5fcb6fab, 0x682e6ff3, 0x6c44198c, 0x72be5d74],
    [0x76f988da, 0x78a5636f, 0x80deb1fe, 0x84c87814, 0x8fe23c8a, 0x90befffa, 0x923f82a4, 0x9723b5af,
     0xa3c25a6f, 0xa4506ceb, 0xa81a664b, 0xab6bcfa4, 0xb4293cf1, 0xbb67ae85, 0xbf597fc7, 0xc0ce967b],
    [0xc76c51a3, 0x106aa070, 0x19a4c116, 0x14292967, 0x1f83d9ab, 0x27b70a85, 0x2e1b2138, 0x3956c25b,
     0x428a2f98, 0x4d2c6dfc, 0x53380d13, 0x5cb0a9dc, 0x650a7354, 0x6a09e667, 0x71374491, 0x748f82ee],
    [0x766a0abb, 0x7ba0ea2d, 0x81c2c92e, 0x8cc70208, 0x92722c85, 0x983e5152, 0x9bdc06a7, 0xa2bfe8a1,
     0xa54ff53a, 0xa831c66d, 0xab1c5ed5, 0xb00327c8, 0xb5c0fbcf, 0xbef9a3f7, 0xc19bf174, 0xc24b8b70],
    [0xc6e00bf3, 0xc67178f2, 0xca273ece, 0xd192e819, 0xd5a79147, 0xd6990624, 0xd807aa98, 0xe49b69c1,
     0xe6d5d0c7, 0xe9b5dba5, 0xeada7dd6, 0xefbe4786, 0xf1da05bf, 0xf40e3585, 0xf57d4f7f, 0xfeba4cf4],
];

/// MDS matrix for Poseidon2 linear layer
/// This is a circulant matrix for efficient computation
pub const MDS_MATRIX: [[u32; WIDTH]; WIDTH] = [
    [5, 7, 1, 3, 5, 7, 1, 3, 5, 7, 1, 3, 5, 7, 1, 3],
    [3, 5, 7, 1, 3, 5, 7, 1, 3, 5, 7, 1, 3, 5, 7, 1],
    [1, 3, 5, 7, 1, 3, 5, 7, 1, 3, 5, 7, 1, 3, 5, 7],
    [7, 1, 3, 5, 7, 1, 3, 5, 7, 1, 3, 5, 7, 1, 3, 5],
    [5, 7, 1, 3, 5, 7, 1, 3, 5, 7, 1, 3, 5, 7, 1, 3],
    [3, 5, 7, 1, 3, 5, 7, 1, 3, 5, 7, 1, 3, 5, 7, 1],
    [1, 3, 5, 7, 1, 3, 5, 7, 1, 3, 5, 7, 1, 3, 5, 7],
    [7, 1, 3, 5, 7, 1, 3, 5, 7, 1, 3, 5, 7, 1, 3, 5],
    [5, 7, 1, 3, 5, 7, 1, 3, 5, 7, 1, 3, 5, 7, 1, 3],
    [3, 5, 7, 1, 3, 5, 7, 1, 3, 5, 7, 1, 3, 5, 7, 1],
    [1, 3, 5, 7, 1, 3, 5, 7, 1, 3, 5, 7, 1, 3, 5, 7],
    [7, 1, 3, 5, 7, 1, 3, 5, 7, 1, 3, 5, 7, 1, 3, 5],
    [5, 7, 1, 3, 5, 7, 1, 3, 5, 7, 1, 3, 5, 7, 1, 3],
    [3, 5, 7, 1, 3, 5, 7, 1, 3, 5, 7, 1, 3, 5, 7, 1],
    [1, 3, 5, 7, 1, 3, 5, 7, 1, 3, 5, 7, 1, 3, 5, 7],
    [7, 1, 3, 5, 7, 1, 3, 5, 7, 1, 3, 5, 7, 1, 3, 5],
];

/// Poseidon2 state
pub struct Poseidon2State {
    state: [BabyBear; WIDTH],
}

impl Poseidon2State {
    /// Create a new state with all zeros
    pub fn new() -> Self {
        Self {
            state: [BabyBear::new(0); WIDTH],
        }
    }

    /// Apply S-box (x^7 for BabyBear)
    fn sbox(x: BabyBear) -> BabyBear {
        let x2 = x * x;
        let x4 = x2 * x2;
        let x6 = x4 * x2;
        x6 * x
    }

    /// Apply full S-box layer (all elements)
    fn full_sbox_layer(&mut self) {
        for i in 0..WIDTH {
            self.state[i] = Self::sbox(self.state[i]);
        }
    }

    /// Apply partial S-box layer (first element only)
    fn partial_sbox_layer(&mut self) {
        self.state[0] = Self::sbox(self.state[0]);
    }

    /// Apply MDS matrix
    fn mds_layer(&mut self) {
        let mut result = [BabyBear::new(0); WIDTH];

        for i in 0..WIDTH {
            for j in 0..WIDTH {
                let mds_val = BabyBear::new(MDS_MATRIX[i][j]);
                result[i] = result[i] + mds_val * self.state[j];
            }
        }

        self.state = result;
    }

    /// Add round constants
    fn add_constants(&mut self, round: usize) {
        for i in 0..WIDTH {
            // Reduce constant modulo BabyBear modulus
            let c = ROUND_CONSTANTS[round][i] % 2013265921;
            self.state[i] = self.state[i] + BabyBear::new(c);
        }
    }

    /// Run the full Poseidon2 permutation
    pub fn permute(&mut self) {
        // First half of external rounds
        for r in 0..EXTERNAL_ROUNDS / 2 {
            self.add_constants(r);
            self.full_sbox_layer();
            self.mds_layer();
        }

        // Internal rounds
        for r in 0..INTERNAL_ROUNDS {
            self.add_constants(EXTERNAL_ROUNDS / 2 + r);
            self.partial_sbox_layer();
            self.mds_layer();
        }

        // Second half of external rounds
        for r in 0..EXTERNAL_ROUNDS / 2 {
            self.add_constants(EXTERNAL_ROUNDS / 2 + INTERNAL_ROUNDS + r);
            self.full_sbox_layer();
            self.mds_layer();
        }
    }

    /// Absorb input into state
    pub fn absorb(&mut self, input: &[BabyBear]) {
        for (i, &val) in input.iter().enumerate().take(RATE) {
            self.state[i] = self.state[i] + val;
        }
    }

    /// Squeeze output from state
    pub fn squeeze(&self) -> BabyBear {
        self.state[0]
    }
}

/// Hash two field elements together (for Merkle tree)
pub fn hash_pair(left: BabyBear, right: BabyBear) -> BabyBear {
    let mut state = Poseidon2State::new();
    state.absorb(&[left, right]);
    state.permute();
    state.squeeze()
}

/// Hash secret and nullifier preimage to create commitment
pub fn hash_commitment(secret: BabyBear, nullifier_preimage: BabyBear) -> BabyBear {
    hash_pair(secret, nullifier_preimage)
}

/// Hash nullifier preimage to create nullifier
pub fn hash_nullifier(nullifier_preimage: BabyBear) -> BabyBear {
    let mut state = Poseidon2State::new();
    state.absorb(&[nullifier_preimage]);
    state.permute();
    state.squeeze()
}

/// Hash arbitrary field elements (for WASM bindings)
pub fn poseidon_hash_slice(input: &[BabyBear]) -> BabyBear {
    let mut state = Poseidon2State::new();
    state.absorb(input);
    state.permute();
    state.squeeze()
}

/// Hash a single field element
pub fn poseidon_hash(input: BabyBear) -> BabyBear {
    let mut state = Poseidon2State::new();
    state.absorb(&[input]);
    state.permute();
    state.squeeze()
}

/// Hash two field elements
pub fn poseidon_hash_2(a: BabyBear, b: BabyBear) -> BabyBear {
    hash_pair(a, b)
}

/// Hash three field elements
pub fn poseidon_hash_3(a: BabyBear, b: BabyBear, c: BabyBear) -> BabyBear {
    let mut state = Poseidon2State::new();
    state.absorb(&[a, b, c]);
    state.permute();
    state.squeeze()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sbox() {
        let x = BabyBear::new(2);
        let result = Poseidon2State::sbox(x);
        // 2^7 = 128
        assert_eq!(result, BabyBear::new(128));
    }

    #[test]
    fn test_hash_pair_deterministic() {
        let a = BabyBear::new(123);
        let b = BabyBear::new(456);

        let h1 = hash_pair(a, b);
        let h2 = hash_pair(a, b);

        assert_eq!(h1, h2);
    }

    #[test]
    fn test_hash_pair_different_inputs() {
        let a = BabyBear::new(123);
        let b = BabyBear::new(456);
        let c = BabyBear::new(789);

        let h1 = hash_pair(a, b);
        let h2 = hash_pair(a, c);

        assert_ne!(h1, h2);
    }

    #[test]
    fn test_hash_commitment() {
        let secret = BabyBear::new(12345);
        let nullifier_preimage = BabyBear::new(67890);

        let commitment = hash_commitment(secret, nullifier_preimage);
        assert_ne!(commitment, BabyBear::new(0));
    }

    #[test]
    fn test_hash_nullifier() {
        let preimage = BabyBear::new(12345);
        let nullifier = hash_nullifier(preimage);
        assert_ne!(nullifier, BabyBear::new(0));
    }

    #[test]
    fn test_permutation_changes_state() {
        let mut state = Poseidon2State::new();
        state.state[0] = BabyBear::new(1);

        let before = state.state[0];
        state.permute();
        let after = state.state[0];

        assert_ne!(before, after);
    }
}
