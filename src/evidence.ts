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

import type {
  OperationType,
  PlunderRecord,
  PlunderResult,
  EvidenceChainVerification,
  RaidResult,
} from "./types";

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
    const dataToHash = JSON.stringify({
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
