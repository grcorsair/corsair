/**
 * Merkle Tree Utilities Tests
 *
 * Tests for SHA-256 Merkle tree implementation supporting
 * SCITT transparency log inclusion proofs.
 */

import { describe, test, expect } from "bun:test";
import * as crypto from "crypto";
import {
  computeLeafHash,
  computeNodeHash,
  computeRootHash,
  generateInclusionProof,
  verifyInclusionProof,
} from "../../src/parley/merkle";

function sha256(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

describe("Merkle Tree Utilities", () => {
  // =========================================================================
  // LEAF HASHING
  // =========================================================================
  describe("computeLeafHash", () => {
    test("should return SHA-256 hash of data", () => {
      const hash = computeLeafHash("hello");
      const expected = sha256("hello");
      expect(hash).toBe(expected);
    });

    test("should produce different hashes for different data", () => {
      const hash1 = computeLeafHash("data1");
      const hash2 = computeLeafHash("data2");
      expect(hash1).not.toBe(hash2);
    });

    test("should produce 64-char hex string", () => {
      const hash = computeLeafHash("test");
      expect(hash.length).toBe(64);
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });
  });

  // =========================================================================
  // NODE HASHING
  // =========================================================================
  describe("computeNodeHash", () => {
    test("should hash concatenation of left and right", () => {
      const left = "aaaa";
      const right = "bbbb";
      const hash = computeNodeHash(left, right);
      const expected = sha256(left + right);
      expect(hash).toBe(expected);
    });

    test("should be order-dependent", () => {
      const a = computeLeafHash("a");
      const b = computeLeafHash("b");
      expect(computeNodeHash(a, b)).not.toBe(computeNodeHash(b, a));
    });
  });

  // =========================================================================
  // ROOT HASH COMPUTATION
  // =========================================================================
  describe("computeRootHash", () => {
    test("should return leaf hash for single leaf", () => {
      const leafHash = computeLeafHash("single");
      const root = computeRootHash([leafHash]);
      expect(root).toBe(leafHash);
    });

    test("should hash two leaves", () => {
      const leaf0 = computeLeafHash("a");
      const leaf1 = computeLeafHash("b");
      const root = computeRootHash([leaf0, leaf1]);
      const expected = computeNodeHash(leaf0, leaf1);
      expect(root).toBe(expected);
    });

    test("should build balanced tree with 4 leaves", () => {
      const leaves = ["a", "b", "c", "d"].map(computeLeafHash);
      const root = computeRootHash(leaves);

      // Manual computation:
      // Level 1: H(a,b), H(c,d)
      // Level 0 (root): H(H(a,b), H(c,d))
      const n01 = computeNodeHash(leaves[0]!, leaves[1]!);
      const n23 = computeNodeHash(leaves[2]!, leaves[3]!);
      const expected = computeNodeHash(n01, n23);
      expect(root).toBe(expected);
    });

    test("should handle 3 leaves (non-power-of-2)", () => {
      const leaves = ["a", "b", "c"].map(computeLeafHash);
      const root = computeRootHash(leaves);

      // 3 leaves: duplicate last to get 4
      // Level 1: H(a,b), H(c,c)
      // Level 0: H(H(a,b), H(c,c))
      const n01 = computeNodeHash(leaves[0]!, leaves[1]!);
      const n22 = computeNodeHash(leaves[2]!, leaves[2]!);
      const expected = computeNodeHash(n01, n22);
      expect(root).toBe(expected);
    });

    test("should handle 5 leaves", () => {
      const leaves = ["a", "b", "c", "d", "e"].map(computeLeafHash);
      const root = computeRootHash(leaves);

      // 5 leaves → pad to 6: [a, b, c, d, e, e]
      // Level 2: H(a,b), H(c,d), H(e,e)
      // 3 nodes → pad to 4: [H(a,b), H(c,d), H(e,e), H(e,e)]
      // Level 1: H(H(a,b), H(c,d)), H(H(e,e), H(e,e))
      // Level 0: root
      const n01 = computeNodeHash(leaves[0]!, leaves[1]!);
      const n23 = computeNodeHash(leaves[2]!, leaves[3]!);
      const n44 = computeNodeHash(leaves[4]!, leaves[4]!);
      const l1_0 = computeNodeHash(n01, n23);
      const l1_1 = computeNodeHash(n44, n44);
      const expected = computeNodeHash(l1_0, l1_1);
      expect(root).toBe(expected);
    });

    test("should handle 7 leaves", () => {
      const leaves = ["a", "b", "c", "d", "e", "f", "g"].map(computeLeafHash);
      const root = computeRootHash(leaves);

      // 7 leaves → pad to 8: [a, b, c, d, e, f, g, g]
      const n01 = computeNodeHash(leaves[0]!, leaves[1]!);
      const n23 = computeNodeHash(leaves[2]!, leaves[3]!);
      const n45 = computeNodeHash(leaves[4]!, leaves[5]!);
      const n67 = computeNodeHash(leaves[6]!, leaves[6]!);
      const l1_0 = computeNodeHash(n01, n23);
      const l1_1 = computeNodeHash(n45, n67);
      const expected = computeNodeHash(l1_0, l1_1);
      expect(root).toBe(expected);
    });

    test("should throw on empty input", () => {
      expect(() => computeRootHash([])).toThrow();
    });

    test("should be deterministic", () => {
      const leaves = ["x", "y", "z"].map(computeLeafHash);
      const root1 = computeRootHash(leaves);
      const root2 = computeRootHash(leaves);
      expect(root1).toBe(root2);
    });
  });

  // =========================================================================
  // INCLUSION PROOF GENERATION
  // =========================================================================
  describe("generateInclusionProof", () => {
    test("should generate proof for single leaf", () => {
      const leaves = [computeLeafHash("only")];
      const proof = generateInclusionProof(0, leaves);
      expect(proof.hashes.length).toBe(0);
      expect(proof.directions.length).toBe(0);
    });

    test("should generate proof for left leaf in 2-leaf tree", () => {
      const leaves = ["a", "b"].map(computeLeafHash);
      const proof = generateInclusionProof(0, leaves);

      expect(proof.hashes.length).toBe(1);
      expect(proof.hashes[0]).toBe(leaves[1]); // sibling
      expect(proof.directions[0]).toBe("right");
    });

    test("should generate proof for right leaf in 2-leaf tree", () => {
      const leaves = ["a", "b"].map(computeLeafHash);
      const proof = generateInclusionProof(1, leaves);

      expect(proof.hashes.length).toBe(1);
      expect(proof.hashes[0]).toBe(leaves[0]); // sibling
      expect(proof.directions[0]).toBe("left");
    });

    test("should generate proof for 4-leaf tree", () => {
      const leaves = ["a", "b", "c", "d"].map(computeLeafHash);
      const proof = generateInclusionProof(2, leaves);

      // Leaf 2 (c): sibling is d (right), then H(a,b) is on the left
      expect(proof.hashes.length).toBe(2);
    });

    test("should throw for out-of-bounds index", () => {
      const leaves = ["a", "b"].map(computeLeafHash);
      expect(() => generateInclusionProof(2, leaves)).toThrow();
      expect(() => generateInclusionProof(-1, leaves)).toThrow();
    });
  });

  // =========================================================================
  // INCLUSION PROOF VERIFICATION
  // =========================================================================
  describe("verifyInclusionProof", () => {
    test("should verify proof for single leaf", () => {
      const leaves = [computeLeafHash("only")];
      const root = computeRootHash(leaves);
      const proof = generateInclusionProof(0, leaves);

      expect(verifyInclusionProof(leaves[0]!, proof, root)).toBe(true);
    });

    test("should verify proof for each leaf in 2-leaf tree", () => {
      const leaves = ["a", "b"].map(computeLeafHash);
      const root = computeRootHash(leaves);

      for (let i = 0; i < leaves.length; i++) {
        const proof = generateInclusionProof(i, leaves);
        expect(verifyInclusionProof(leaves[i]!, proof, root)).toBe(true);
      }
    });

    test("should verify proof for each leaf in 4-leaf tree", () => {
      const leaves = ["a", "b", "c", "d"].map(computeLeafHash);
      const root = computeRootHash(leaves);

      for (let i = 0; i < leaves.length; i++) {
        const proof = generateInclusionProof(i, leaves);
        expect(verifyInclusionProof(leaves[i]!, proof, root)).toBe(true);
      }
    });

    test("should verify proof for each leaf in 5-leaf tree", () => {
      const leaves = ["a", "b", "c", "d", "e"].map(computeLeafHash);
      const root = computeRootHash(leaves);

      for (let i = 0; i < leaves.length; i++) {
        const proof = generateInclusionProof(i, leaves);
        expect(verifyInclusionProof(leaves[i]!, proof, root)).toBe(true);
      }
    });

    test("should verify proof for each leaf in 7-leaf tree", () => {
      const leaves = ["a", "b", "c", "d", "e", "f", "g"].map(computeLeafHash);
      const root = computeRootHash(leaves);

      for (let i = 0; i < leaves.length; i++) {
        const proof = generateInclusionProof(i, leaves);
        expect(verifyInclusionProof(leaves[i]!, proof, root)).toBe(true);
      }
    });

    test("should fail with wrong leaf hash", () => {
      const leaves = ["a", "b", "c", "d"].map(computeLeafHash);
      const root = computeRootHash(leaves);
      const proof = generateInclusionProof(0, leaves);

      const wrongLeaf = computeLeafHash("wrong");
      expect(verifyInclusionProof(wrongLeaf, proof, root)).toBe(false);
    });

    test("should fail with wrong root hash", () => {
      const leaves = ["a", "b", "c", "d"].map(computeLeafHash);
      const proof = generateInclusionProof(0, leaves);

      const wrongRoot = computeLeafHash("wrong-root");
      expect(verifyInclusionProof(leaves[0]!, proof, wrongRoot)).toBe(false);
    });

    test("should fail with swapped proof hashes", () => {
      const leaves = ["a", "b", "c", "d"].map(computeLeafHash);
      const root = computeRootHash(leaves);
      const proof = generateInclusionProof(0, leaves);

      if (proof.hashes.length >= 2) {
        // Swap the proof hashes
        const swapped = {
          hashes: [...proof.hashes].reverse(),
          directions: [...proof.directions].reverse(),
        };
        expect(verifyInclusionProof(leaves[0]!, swapped, root)).toBe(false);
      }
    });

    test("should verify proof for 8-leaf balanced tree", () => {
      const leaves = ["a", "b", "c", "d", "e", "f", "g", "h"].map(computeLeafHash);
      const root = computeRootHash(leaves);

      for (let i = 0; i < leaves.length; i++) {
        const proof = generateInclusionProof(i, leaves);
        expect(verifyInclusionProof(leaves[i]!, proof, root)).toBe(true);
        // Proof should have log2(8) = 3 hashes
        expect(proof.hashes.length).toBe(3);
      }
    });
  });
});
