/**
 * Evidence Controller
 *
 * Core-controlled evidence writes maintaining hash chain integrity.
 *
 * Key Principle: Plugins PROPOSE evidence, Core WRITES evidence.
 *
 * This separation ensures:
 * - Single writer for hash chain (prevents race conditions)
 * - Cryptographic integrity (SHA-256 chain unbroken)
 * - Audit trail (all events routed through one controller)
 * - Provider-agnostic (works with any plugin)
 *
 * Design Pattern:
 * Plugins return PluginRaidResult with `proposedEvidence` field.
 * EvidenceController wraps this in PlunderRecord with:
 * - Sequence number
 * - Timestamp
 * - Operation type
 * - Previous hash (linking)
 * - Computed hash (integrity)
 */

import { createHash } from "crypto";
import { appendFileSync, readFileSync, writeFileSync, existsSync } from "fs";
import type {
  PluginRaidResult,
  EvidenceType
} from "../types/provider-plugin";

/**
 * PlunderRecord - JSONL evidence format
 *
 * Each line in the evidence file is one PlunderRecord.
 * Hash chain links all records cryptographically.
 */
interface PlunderRecord {
  sequence: number;
  timestamp: string;
  operation: string;
  data: unknown;
  previousHash: string | null;
  hash: string;
}

/**
 * PlunderResult - Evidence write confirmation
 *
 * Returned after successfully writing evidence.
 * Includes verification status and audit readiness.
 */
interface PlunderResult {
  evidencePath: string;
  eventCount: number;
  chainVerified: boolean;
  immutable: boolean;
  auditReady: boolean;
}

/**
 * EvidenceChainVerification - Chain integrity check result
 */
interface EvidenceChainVerification {
  valid: boolean;
  recordCount: number;
  brokenAt: number | null;
}

/**
 * EvidenceController - Single writer for hash chain
 *
 * All evidence writes go through this controller to maintain
 * cryptographic integrity. Plugins propose data, controller writes.
 */
export class EvidenceController {
  private evidencePath: string;
  private sequence: number = 0;
  private lastHash: string | null = null;

  /**
   * @param evidencePath - Path to JSONL evidence file
   */
  constructor(evidencePath: string) {
    this.evidencePath = evidencePath;

    // Initialize from existing file if present
    if (existsSync(evidencePath)) {
      this.loadExistingChain();
    }
  }

  /**
   * Load existing chain state from file
   *
   * Reads last sequence and hash from evidence file.
   * This allows resuming evidence collection across restarts.
   */
  private loadExistingChain(): void {
    try {
      const content = readFileSync(this.evidencePath, "utf-8").trim();
      if (!content) {
        this.sequence = 0;
        this.lastHash = null;
        return;
      }

      const lines = content.split("\n");
      const lastRecord: PlunderRecord = JSON.parse(lines[lines.length - 1]);

      this.sequence = lastRecord.sequence;
      this.lastHash = lastRecord.hash;
    } catch (error) {
      // If file is malformed, start fresh
      this.sequence = 0;
      this.lastHash = null;
    }
  }

  /**
   * Record plugin raid result
   *
   * Wraps plugin-proposed evidence in PlunderRecord with hash chain.
   * This is the primary way evidence enters the system.
   *
   * @param providerId - Provider that executed raid
   * @param targetId - Target that was raided
   * @param vector - Attack vector used
   * @param pluginResult - Plugin's proposed evidence
   * @returns PlunderResult confirming write
   */
  async recordPluginRaid(
    providerId: string,
    targetId: string,
    vector: string,
    pluginResult: PluginRaidResult
  ): Promise<PlunderResult> {
    const events: PlunderRecord[] = [];

    // Event 1: Raid initiated
    this.sequence++;
    let timestamp = new Date().toISOString();
    let record: Omit<PlunderRecord, "hash"> = {
      sequence: this.sequence,
      timestamp,
      operation: "plugin_raid_initiated",
      data: {
        provider: providerId,
        target: targetId,
        vector: vector
      },
      previousHash: this.lastHash
    };
    let hash = this.computeHash(record);
    events.push({ ...record, hash });
    this.lastHash = hash;

    // Event 2: Raid executed
    this.sequence++;
    timestamp = new Date().toISOString();
    record = {
      sequence: this.sequence,
      timestamp,
      operation: "plugin_raid_executed",
      data: {
        provider: providerId,
        target: targetId,
        vector: vector,
        success: pluginResult.success,
        controlsHeld: pluginResult.controlsHeld,
        findings: pluginResult.findings,
        pluginEvidence: pluginResult.proposedEvidence || {}
      },
      previousHash: this.lastHash
    };
    hash = this.computeHash(record);
    events.push({ ...record, hash });
    this.lastHash = hash;

    // Event 3: Raid completed
    this.sequence++;
    timestamp = new Date().toISOString();
    record = {
      sequence: this.sequence,
      timestamp,
      operation: "plugin_raid_completed",
      data: {
        provider: providerId,
        target: targetId,
        eventCount: pluginResult.timeline.length
      },
      previousHash: this.lastHash
    };
    hash = this.computeHash(record);
    events.push({ ...record, hash });
    this.lastHash = hash;

    // Write all events to JSONL
    for (const event of events) {
      appendFileSync(this.evidencePath, JSON.stringify(event) + "\n");
    }

    // Verify chain integrity
    const verification = this.verifyChain();

    return {
      evidencePath: this.evidencePath,
      eventCount: events.length,
      chainVerified: verification.valid,
      immutable: true, // JSONL is append-only
      auditReady: verification.valid && events.length > 0
    };
  }

  /**
   * Compute SHA-256 hash for record
   *
   * Hash includes all fields except the hash itself.
   * This creates tamper-evident chaining.
   *
   * @param record - Record without hash field
   * @returns Hex-encoded SHA-256 hash
   */
  private computeHash(record: Omit<PlunderRecord, "hash">): string {
    const dataToHash = JSON.stringify({
      sequence: record.sequence,
      timestamp: record.timestamp,
      operation: record.operation,
      data: record.data,
      previousHash: record.previousHash
    });

    return createHash("sha256").update(dataToHash).digest("hex");
  }

  /**
   * Verify hash chain integrity
   *
   * Checks that:
   * - Each record's previousHash matches previous record's hash
   * - Each record's hash is correctly computed
   *
   * @returns Verification result with broken point if invalid
   */
  verifyChain(): EvidenceChainVerification {
    if (!existsSync(this.evidencePath)) {
      return { valid: true, recordCount: 0, brokenAt: null };
    }

    const content = readFileSync(this.evidencePath, "utf-8").trim();
    if (!content) {
      return { valid: true, recordCount: 0, brokenAt: null };
    }

    const lines = content.split("\n");
    let previousHash: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const record: PlunderRecord = JSON.parse(lines[i]);

      // Verify previousHash linkage
      if (record.previousHash !== previousHash) {
        return {
          valid: false,
          recordCount: lines.length,
          brokenAt: i + 1
        };
      }

      // Verify hash computation
      const expectedHash = this.computeHash({
        sequence: record.sequence,
        timestamp: record.timestamp,
        operation: record.operation,
        data: record.data,
        previousHash: record.previousHash
      });

      if (record.hash !== expectedHash) {
        return {
          valid: false,
          recordCount: lines.length,
          brokenAt: i + 1
        };
      }

      previousHash = record.hash;
    }

    return {
      valid: true,
      recordCount: lines.length,
      brokenAt: null
    };
  }

  /**
   * Reset evidence chain (testing only)
   *
   * WARNING: Destroys all evidence. Only use in tests.
   */
  reset(): void {
    this.sequence = 0;
    this.lastHash = null;
    if (existsSync(this.evidencePath)) {
      writeFileSync(this.evidencePath, "");
    }
  }

  /**
   * Get current sequence number
   */
  getSequence(): number {
    return this.sequence;
  }

  /**
   * Get last hash in chain
   */
  getLastHash(): string | null {
    return this.lastHash;
  }
}
