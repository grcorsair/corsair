/**
 * Merkle Tree Utilities
 *
 * SHA-256 binary Merkle tree for SCITT transparency log inclusion proofs.
 * Zero external dependencies — uses Node.js crypto.
 */

import * as crypto from "crypto";

/**
 * Compute the leaf hash of a data string.
 * Returns hex-encoded SHA-256.
 */
export function computeLeafHash(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Compute the internal node hash from two child hashes.
 * H(left || right) as hex-encoded SHA-256.
 */
export function computeNodeHash(left: string, right: string): string {
  return crypto.createHash("sha256").update(left + right).digest("hex");
}

/**
 * Compute the Merkle root hash from a list of leaf hashes.
 *
 * For non-power-of-2 leaf counts, the last element at each level
 * is duplicated to make the count even.
 *
 * @throws If leafHashes is empty
 */
export function computeRootHash(leafHashes: string[]): string {
  if (leafHashes.length === 0) {
    throw new Error("Cannot compute root hash of empty leaf set");
  }

  let level = [...leafHashes];

  while (level.length > 1) {
    const next: string[] = [];
    // Duplicate last if odd
    if (level.length % 2 !== 0) {
      level.push(level[level.length - 1]!);
    }
    for (let i = 0; i < level.length; i += 2) {
      next.push(computeNodeHash(level[i]!, level[i + 1]!));
    }
    level = next;
  }

  return level[0]!;
}

export interface InclusionProof {
  hashes: string[];
  directions: ("left" | "right")[];
}

/**
 * Generate a Merkle inclusion proof for a leaf at the given index.
 *
 * The proof consists of sibling hashes from the leaf up to the root,
 * with direction indicators showing which side the sibling is on.
 *
 * @throws If leafIndex is out of bounds
 */
export function generateInclusionProof(
  leafIndex: number,
  leafHashes: string[],
): InclusionProof {
  if (leafIndex < 0 || leafIndex >= leafHashes.length) {
    throw new Error(`Leaf index ${leafIndex} out of bounds [0, ${leafHashes.length - 1}]`);
  }

  if (leafHashes.length === 1) {
    return { hashes: [], directions: [] };
  }

  const hashes: string[] = [];
  const directions: ("left" | "right")[] = [];

  let level = [...leafHashes];
  let idx = leafIndex;

  while (level.length > 1) {
    // Duplicate last if odd
    if (level.length % 2 !== 0) {
      level.push(level[level.length - 1]!);
    }

    // Determine sibling
    const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    hashes.push(level[siblingIdx]!);
    directions.push(idx % 2 === 0 ? "right" : "left");

    // Build next level
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(computeNodeHash(level[i]!, level[i + 1]!));
    }

    level = next;
    idx = Math.floor(idx / 2);
  }

  return { hashes, directions };
}

/**
 * Verify a Merkle inclusion proof.
 *
 * Walks from the leaf hash up to the root using the proof hashes and
 * direction indicators, then compares with the expected root hash.
 */
export function verifyInclusionProof(
  leafHash: string,
  proof: InclusionProof,
  rootHash: string,
): boolean {
  let current = leafHash;

  for (let i = 0; i < proof.hashes.length; i++) {
    const sibling = proof.hashes[i]!;
    const direction = proof.directions[i]!;

    if (direction === "right") {
      // Sibling is on the right
      current = computeNodeHash(current, sibling);
    } else {
      // Sibling is on the left
      current = computeNodeHash(sibling, current);
    }
  }

  return current === rootHash;
}
