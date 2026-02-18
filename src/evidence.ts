/**
 * CORSAIR MVP - Evidence Engine
 *
 * Handles JSONL evidence generation and cryptographic hash chain verification.
 * Extracted from corsair-mvp.ts for better modularity.
 *
 * OpenClaw Patterns:
 * - Pattern 3: JSONL Serialization (append-only, SHA-256 chain)
 * - Pattern 8: Hash Chain verification
 */

import { createHash } from "crypto";
import { appendFileSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";

import { computeRootHash, generateInclusionProof, verifyInclusionProof } from "./parley/merkle";

import type {
  OperationType,
  PlunderRecord,
  PlunderResult,
  EvidenceChainVerification,
  RaidResult,
} from "./types";

export const EVIDENCE_CHAIN_TYPE = "hash-linked" as const;
export const EVIDENCE_HASH_ALGORITHM = "sha256" as const;
export const EVIDENCE_CANONICALIZATION = "sorted-json-v1" as const;

export interface EvidenceChainItemSummary {
  recordCount: number;
  chainStartHash: string;
  chainHeadHash: string;
  chainDigest: string;
  chainVerified: boolean;
}

export interface EvidenceChainAggregate {
  chainType: typeof EVIDENCE_CHAIN_TYPE;
  algorithm: typeof EVIDENCE_HASH_ALGORITHM;
  canonicalization: typeof EVIDENCE_CANONICALIZATION;
  recordCount: number;
  chainVerified: boolean;
  chainDigest: string;
  chainStartHash?: string;
  chainHeadHash?: string;
  chains?: EvidenceChainItemSummary[];
}

export interface EvidenceChainMatchResult {
  ok: boolean;
  errors: string[];
  actual?: EvidenceChainAggregate | null;
  expected?: Partial<EvidenceChainAggregate> | null;
}

export interface EvidenceReceiptProofStep {
  hash: string;
  direction: "left" | "right";
}

export interface EvidenceReceiptChain {
  chainType: typeof EVIDENCE_CHAIN_TYPE;
  algorithm: typeof EVIDENCE_HASH_ALGORITHM;
  canonicalization: typeof EVIDENCE_CANONICALIZATION;
  recordCount: number;
  chainVerified: boolean;
  chainDigest: string;
}

export interface EvidenceReceipt {
  type: "CorsairEvidenceReceipt";
  version: "1.0";
  recordHash: string;
  chain: EvidenceReceiptChain;
  proof: EvidenceReceiptProofStep[];
  meta?: {
    sequence?: number;
    timestamp?: string;
    operation?: string;
    evidencePath?: string;
  };
}

export interface EvidenceReceiptVerificationResult {
  ok: boolean;
  errors: string[];
}

/**
 * EvidenceEngine - JSONL Evidence Generation with Cryptographic Hash Chain
 *
 * Responsibilities:
 * - Generate JSONL evidence records with SHA-256 hash chain
  * - Verify hash chain integrity
 * - Read and write JSONL files
 */
export class EvidenceEngine {
  private sequence: number = 0;
  private lastHash: string | null = null;
  private defaultEvidencePath: string;

  constructor(evidencePath: string = "./corsair-evidence.jsonl") {
    this.defaultEvidencePath = evidencePath;
  }

  /**
   * Generate JSONL evidence from a raid result.
   * Creates three records: initiation, execution, and completion.
   * Each record contains a SHA-256 hash linking to the previous record.
   *
   * @param raidResult - The raid result to extract evidence from
   * @param evidencePath - Path to write JSONL evidence
   * @returns PlunderResult with evidence metadata
   */
  async plunder(raidResult: RaidResult, evidencePath: string): Promise<PlunderResult> {
    const events: PlunderRecord[] = [];

    // Event 1: Raid initiation
    this.sequence++;
    let timestamp = new Date().toISOString();
    let record: Omit<PlunderRecord, "hash"> = {
      sequence: this.sequence,
      timestamp,
      operation: "raid_initiated" as OperationType,
      data: {
        raidId: raidResult.raidId,
        target: raidResult.target,
        vector: raidResult.vector,
      },
      previousHash: this.lastHash,
    };
    let hash = this.calculateHash(record);
    events.push({ ...record, hash });
    this.lastHash = hash;

    // Event 2: Raid execution
    this.sequence++;
    timestamp = new Date().toISOString();
    record = {
      sequence: this.sequence,
      timestamp,
      operation: "raid_executed" as OperationType,
      data: {
        raidId: raidResult.raidId,
        success: raidResult.success,
        controlsHeld: raidResult.controlsHeld,
        findings: raidResult.findings,
      },
      previousHash: this.lastHash,
    };
    hash = this.calculateHash(record);
    events.push({ ...record, hash });
    this.lastHash = hash;

    // Event 3: Raid completion
    this.sequence++;
    timestamp = new Date().toISOString();
    record = {
      sequence: this.sequence,
      timestamp,
      operation: "raid_completed" as OperationType,
      data: {
        raidId: raidResult.raidId,
        durationMs: raidResult.durationMs,
        serialized: raidResult.serialized,
      },
      previousHash: this.lastHash,
    };
    hash = this.calculateHash(record);
    events.push({ ...record, hash });
    this.lastHash = hash;

    // Ensure evidence directory exists before writing
    const evidenceDir = dirname(evidencePath);
    if (!existsSync(evidenceDir)) {
      mkdirSync(evidenceDir, { recursive: true });
    }

    // Write all events to JSONL file
    for (const event of events) {
      appendFileSync(evidencePath, JSON.stringify(event) + "\n");
    }

    // Verify chain integrity
    const chainVerified = this.verifyEvidenceChain(evidencePath).valid;

    return {
      evidencePath,
      eventCount: events.length,
      chainVerified,
      immutable: true, // JSONL append-only format
      auditReady: chainVerified && events.length > 0,
    };
  }

  /**
   * Capture evidence from generic data.
   * Creates a single evidence record with the given data.
   * Unlike plunder(), this does not require RaidResult-specific fields
   * and creates only one record instead of three.
   *
   * @param operation - The operation type for this evidence record
   * @param data - Arbitrary data to capture as evidence
   * @param evidencePath - Path to write JSONL evidence
   * @returns PlunderResult with evidence metadata
   */
  async captureEvidence(
    operation: OperationType,
    data: unknown,
    evidencePath: string,
  ): Promise<PlunderResult> {
    this.sequence++;
    const timestamp = new Date().toISOString();
    const record: Omit<PlunderRecord, "hash"> = {
      sequence: this.sequence,
      timestamp,
      operation,
      data,
      previousHash: this.lastHash,
    };
    const hash = this.calculateHash(record);
    const event: PlunderRecord = { ...record, hash };
    this.lastHash = hash;

    // Ensure evidence directory exists before writing
    const evidenceDir = dirname(evidencePath);
    if (!existsSync(evidenceDir)) {
      mkdirSync(evidenceDir, { recursive: true });
    }

    appendFileSync(evidencePath, JSON.stringify(event) + "\n");

    const chainVerified = this.verifyEvidenceChain(evidencePath).valid;

    return {
      evidencePath,
      eventCount: 1,
      chainVerified,
      immutable: true,
      auditReady: chainVerified,
    };
  }

  /**
   * Reset the evidence state.
   * Clears sequence counter and last hash.
   * Optionally clears the evidence file.
   */
  resetEvidence(): void {
    this.sequence = 0;
    this.lastHash = null;
    if (existsSync(this.defaultEvidencePath)) {
      writeFileSync(this.defaultEvidencePath, "");
    }
  }

  /**
   * Verify the integrity of an evidence hash chain.
   * Checks that each record's previousHash matches the actual previous hash,
   * and that each record's hash is correctly computed.
   *
   * @param evidencePath - Path to the JSONL evidence file
   * @returns Verification result with validity status and break point if invalid
   */
  verifyEvidenceChain(evidencePath?: string): EvidenceChainVerification {
    const pathToVerify = evidencePath || this.defaultEvidencePath;

    if (!existsSync(pathToVerify)) {
      return { valid: true, recordCount: 0, brokenAt: null };
    }

    const content = readFileSync(pathToVerify, "utf-8").trim();
    if (!content) {
      return { valid: true, recordCount: 0, brokenAt: null };
    }

    const lines = content.split("\n");
    let previousHash: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const record: PlunderRecord = JSON.parse(lines[i]);

      // Verify previous hash matches
      if (record.previousHash !== previousHash) {
        return { valid: false, recordCount: lines.length, brokenAt: i + 1 };
      }

      // Verify hash computation
      const expectedHash = this.calculateHash({
        sequence: record.sequence,
        timestamp: record.timestamp,
        operation: record.operation,
        data: record.data,
        previousHash: record.previousHash,
      });
      if (record.hash !== expectedHash) {
        return { valid: false, recordCount: lines.length, brokenAt: i + 1 };
      }

      previousHash = record.hash;
    }

    return { valid: true, recordCount: lines.length, brokenAt: null };
  }

  /**
   * Summarize a single evidence chain file.
   * Returns null if the file is missing or empty.
   */
  summarizeChain(evidencePath: string): EvidenceChainItemSummary | null {
    if (!existsSync(evidencePath)) return null;
    const records = this.readJSONLFile(evidencePath);
    if (records.length === 0) return null;

    const verification = this.verifyEvidenceChain(evidencePath);
    const recordCount = records.length;
    const chainStartHash = records[0]!.hash;
    const chainHeadHash = records[records.length - 1]!.hash;
    const chainDigest = computeRootHash(records.map(r => r.hash));

    return {
      recordCount,
      chainStartHash,
      chainHeadHash,
      chainDigest,
      chainVerified: verification.valid,
    };
  }

  /**
   * Summarize multiple evidence chain files into a single aggregate.
   * Returns null if no evidence records are found.
   */
  summarizeChains(evidencePaths: string[]): EvidenceChainAggregate | null {
    const summaries: EvidenceChainItemSummary[] = [];
    for (const evPath of evidencePaths) {
      const summary = this.summarizeChain(evPath);
      if (summary) summaries.push(summary);
    }

    if (summaries.length === 0) return null;

    const recordCount = summaries.reduce((sum, s) => sum + s.recordCount, 0);
    const chainVerified = summaries.every(s => s.chainVerified);
    const chainDigests = summaries.map(s => s.chainDigest).sort();
    const chainDigest = computeRootHash(chainDigests);

    const aggregate: EvidenceChainAggregate = {
      chainType: EVIDENCE_CHAIN_TYPE,
      algorithm: EVIDENCE_HASH_ALGORITHM,
      canonicalization: EVIDENCE_CANONICALIZATION,
      recordCount,
      chainVerified,
      chainDigest,
    };

    if (summaries.length === 1) {
      aggregate.chainStartHash = summaries[0]!.chainStartHash;
      aggregate.chainHeadHash = summaries[0]!.chainHeadHash;
    } else {
      aggregate.chains = summaries;
    }

    return aggregate;
  }

  /**
   * Simple boolean check for hash chain validity.
   *
   * @param evidencePath - Path to the JSONL evidence file
   * @returns true if the chain is valid
   */
  verifyHashChain(evidencePath: string): boolean {
    return this.verifyEvidenceChain(evidencePath).valid;
  }

  /**
   * Calculate SHA-256 hash for a record.
   * @internal
   */
  calculateHash(record: Omit<PlunderRecord, "hash">): string {
    const dataToHash = canonicalJSONStringify({
      sequence: record.sequence,
      timestamp: record.timestamp,
      operation: record.operation,
      data: record.data,
      previousHash: record.previousHash,
    });
    return createHash("sha256").update(dataToHash).digest("hex");
  }

  /**
   * Read all records from a JSONL file.
   *
   * @param path - Path to the JSONL file
   * @returns Array of PlunderRecord objects
   */
  readJSONLFile(path: string): PlunderRecord[] {
    if (!existsSync(path)) return [];
    const content = readFileSync(path, "utf-8").trim();
    if (!content) return [];
    return content.split("\n")
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  }

  /**
   * Write records to a JSONL file.
   *
   * @param path - Path to the JSONL file
   * @param records - Array of PlunderRecord objects to write
   */
  writeJSONLFile(path: string, records: PlunderRecord[]): void {
    const content = records
      .map(r => JSON.stringify(r))
      .join("\n") + (records.length > 0 ? "\n" : "");
    writeFileSync(path, content);
  }

  /**
   * Get current sequence number.
   * @internal
   */
  getSequence(): number {
    return this.sequence;
  }

  /**
   * Get last hash in the chain.
   * @internal
   */
  getLastHash(): string | null {
    return this.lastHash;
  }

  /**
   * Set sequence (for restoring state).
   * @internal
   */
  setSequence(seq: number): void {
    this.sequence = seq;
  }

  /**
   * Set last hash (for restoring state).
   * @internal
   */
  setLastHash(hash: string | null): void {
    this.lastHash = hash;
  }
}

// =============================================================================
// EVIDENCE CHAIN COMPARISON
// =============================================================================

export function compareEvidenceChain(
  expected: Partial<EvidenceChainAggregate> | null | undefined,
  actual: EvidenceChainAggregate | null,
): EvidenceChainMatchResult {
  const errors: string[] = [];

  if (!expected) {
    errors.push("missing evidenceChain in CPOE");
  }

  if (!actual) {
    if (expected && expected.recordCount === 0 && expected.chainDigest === "none") {
      return { ok: errors.length === 0, errors, actual, expected };
    }
    errors.push("no evidence records found in provided path(s)");
  }

  if (expected && actual) {
    if (expected.chainType && expected.chainType !== actual.chainType) {
      errors.push(`chainType mismatch: expected ${expected.chainType}`);
    }
    if (expected.algorithm && expected.algorithm !== actual.algorithm) {
      errors.push(`algorithm mismatch: expected ${expected.algorithm}`);
    }
    if (expected.canonicalization && expected.canonicalization !== actual.canonicalization) {
      errors.push(`canonicalization mismatch: expected ${expected.canonicalization}`);
    }
    if (expected.recordCount !== undefined && expected.recordCount !== actual.recordCount) {
      errors.push(`recordCount mismatch: expected ${expected.recordCount}`);
    }
    if (expected.chainDigest && expected.chainDigest !== actual.chainDigest) {
      errors.push("chainDigest mismatch");
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    actual,
    expected,
  };
}

// =============================================================================
// EVIDENCE RECEIPTS
// =============================================================================

export function generateEvidenceReceipts(
  evidencePath: string,
  options?: { indexes?: number[]; recordHashes?: string[]; includeMeta?: boolean },
): EvidenceReceipt[] {
  const engine = new EvidenceEngine();
  const records = engine.readJSONLFile(evidencePath);
  if (records.length === 0) {
    throw new Error(`No evidence records found at ${evidencePath}`);
  }

  const leafHashes = records.map(r => r.hash);
  const chainDigest = computeRootHash(leafHashes);
  const verification = engine.verifyEvidenceChain(evidencePath);

  const chain: EvidenceReceiptChain = {
    chainType: EVIDENCE_CHAIN_TYPE,
    algorithm: EVIDENCE_HASH_ALGORITHM,
    canonicalization: EVIDENCE_CANONICALIZATION,
    recordCount: records.length,
    chainVerified: verification.valid,
    chainDigest,
  };

  const indexes = new Set<number>();
  for (const idx of options?.indexes ?? []) {
    if (!Number.isInteger(idx)) {
      throw new Error(`Invalid index: ${idx}`);
    }
    if (idx < 0 || idx >= records.length) {
      throw new Error(`Index out of range: ${idx}`);
    }
    indexes.add(idx);
  }

  for (const hash of options?.recordHashes ?? []) {
    const idx = records.findIndex(r => r.hash === hash);
    if (idx === -1) {
      throw new Error(`Record hash not found: ${hash}`);
    }
    indexes.add(idx);
  }

  if (indexes.size === 0) {
    throw new Error("At least one index or record hash is required");
  }

  const sortedIndexes = Array.from(indexes).sort((a, b) => a - b);
  return sortedIndexes.map(idx => {
    const proof = generateInclusionProof(idx, leafHashes);
    const steps = proof.hashes.map((hash, i) => ({
      hash,
      direction: proof.directions[i]!,
    }));
    const meta = options?.includeMeta
      ? {
        sequence: records[idx]!.sequence,
        timestamp: records[idx]!.timestamp,
        operation: records[idx]!.operation,
        evidencePath,
      }
      : undefined;

    return {
      type: "CorsairEvidenceReceipt",
      version: "1.0",
      recordHash: records[idx]!.hash,
      chain,
      proof: steps,
      ...(meta ? { meta } : {}),
    };
  });
}

export function verifyEvidenceReceipt(
  receipt: EvidenceReceipt,
  expectedChainDigest?: string,
): EvidenceReceiptVerificationResult {
  const errors: string[] = [];

  if (receipt.type !== "CorsairEvidenceReceipt") {
    errors.push("invalid receipt type");
  }

  if (receipt.version !== "1.0") {
    errors.push("unsupported receipt version");
  }

  if (expectedChainDigest && receipt.chain.chainDigest !== expectedChainDigest) {
    errors.push("chainDigest mismatch");
  }

  if (!receipt.chain.chainVerified) {
    errors.push("chain not verified");
  }

  const proof = {
    hashes: receipt.proof.map(step => step.hash),
    directions: receipt.proof.map(step => step.direction),
  };

  const valid = verifyInclusionProof(receipt.recordHash, proof, receipt.chain.chainDigest);
  if (!valid) {
    errors.push("invalid inclusion proof");
  }

  return { ok: errors.length === 0, errors };
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

function canonicalJSONStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}
