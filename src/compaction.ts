/**
 * CORSAIR MVP - Compaction Engine
 *
 * Handles evidence file compaction to prevent unbounded JSONL growth.
 * Extracted from corsair-mvp.ts for better modularity.
 *
 * OpenClaw Patterns:
 * - Pattern 1: Compaction (prevent unbounded growth)
 * - Pattern 3: JSONL Serialization (preserve hash chain after compaction)
 */

import { createHash } from "crypto";
import { existsSync, statSync, copyFileSync } from "fs";

import type {
  OperationType,
  PlunderRecord,
  CompactionResult,
  CompactionSummary,
  EvidenceChainVerification,
} from "./types";

import { EvidenceEngine } from "./evidence";

/**
 * CompactionEngine - Evidence File Compaction
 *
 * Responsibilities:
 * - Compact evidence files by aggregating records into summaries
 * - Preserve hash chain integrity during compaction
 * - Create backups before compaction
 * - Maintain critical findings in summaries
 */
export class CompactionEngine {
  private evidenceEngine: EvidenceEngine;

  constructor(evidenceEngine: EvidenceEngine) {
    this.evidenceEngine = evidenceEngine;
  }

  /**
   * Compact an evidence file by aggregating records into summaries.
   * Preserves hash chain integrity while significantly reducing file size.
   *
   * Process:
   * 1. Verify existing chain is valid (fail if already broken)
   * 2. Create timestamped backup
   * 3. Aggregate records into summary batches
   * 4. Rebuild hash chain for compacted records
   * 5. Write compacted file
   * 6. Verify new chain
   *
   * @param evidencePath - Path to the JSONL evidence file to compact
   * @returns CompactionResult with before/after metrics and backup path
   * @throws Error if file doesn't exist or chain is broken
   */
  async compactEvidence(evidencePath: string): Promise<CompactionResult> {
    // Handle non-existent file
    if (!existsSync(evidencePath)) {
      throw new Error(`Evidence file not found: ${evidencePath}`);
    }

    // 1. Read all records
    const records = this.evidenceEngine.readJSONLFile(evidencePath);
    const beforeSize = records.length > 0 ? statSync(evidencePath).size : 0;
    const beforeCount = records.length;

    // Handle empty file gracefully
    if (beforeCount === 0) {
      return {
        before: { recordCount: 0, fileSizeBytes: 0 },
        after: { recordCount: 0, fileSizeBytes: 0 },
        compression: 0,
        hashChainValid: true,
        backupPath: `${evidencePath}.backup-${Date.now()}`,
        compactedAt: new Date().toISOString(),
      };
    }

    // 2. Verify chain BEFORE compaction
    const beforeChain = this.evidenceEngine.verifyEvidenceChain(evidencePath);
    if (!beforeChain.valid) {
      throw new Error("Cannot compact - hash chain is already broken");
    }

    // 3. Create timestamped backup
    const backupPath = `${evidencePath}.backup-${Date.now()}`;
    copyFileSync(evidencePath, backupPath);

    // 4. Aggregate records into summaries
    const summaries = this.aggregateRecordsForCompaction(records);

    // 5. Rebuild hash chain for compacted records
    const compactedRecords = this.rebuildHashChainForCompaction(summaries);

    // 6. Write compacted file
    this.evidenceEngine.writeJSONLFile(evidencePath, compactedRecords);

    // 7. Verify new chain
    const afterChain = this.evidenceEngine.verifyEvidenceChain(evidencePath);
    const afterSize = statSync(evidencePath).size;
    const afterCount = compactedRecords.length;

    // Calculate compression ratio
    const compression = beforeSize > 0 ? (beforeSize - afterSize) / beforeSize : 0;

    return {
      before: { recordCount: beforeCount, fileSizeBytes: beforeSize },
      after: { recordCount: afterCount, fileSizeBytes: afterSize },
      compression,
      hashChainValid: afterChain.valid,
      backupPath,
      compactedAt: new Date().toISOString(),
    };
  }

  /**
   * Aggregate records into compaction summaries.
   * Groups records into batches and creates summary records.
   * @internal
   */
  private aggregateRecordsForCompaction(records: PlunderRecord[]): CompactionSummary[] {
    const summaries: CompactionSummary[] = [];
    const batchSize = 100; // Aggregate every 100 records into 1 summary

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      if (batch.length === 0) continue;

      // Extract critical findings from batch
      const criticalFindings: string[] = [];
      for (const record of batch) {
        const data = record.data as Record<string, unknown>;
        if (data?.findings && Array.isArray(data.findings)) {
          for (const finding of data.findings as string[]) {
            if (typeof finding === "string" && finding.includes("CRITICAL")) {
              criticalFindings.push(finding);
            }
          }
        }
      }

      // Create summary record
      const summary: CompactionSummary = {
        operation: "compaction_summary",
        timeRange: {
          start: batch[0].timestamp,
          end: batch[batch.length - 1].timestamp,
        },
        aggregatedOperations: batch.map(r => r.operation as string),
        recordCount: batch.length,
      };

      // Only include critical findings if there are any
      if (criticalFindings.length > 0) {
        summary.criticalFindings = criticalFindings;
      }

      summaries.push(summary);
    }

    return summaries;
  }

  /**
   * Rebuild hash chain for compacted summary records.
   * Creates proper PlunderRecord entries with valid hash chain.
   * @internal
   */
  private rebuildHashChainForCompaction(summaries: CompactionSummary[]): PlunderRecord[] {
    const records: PlunderRecord[] = [];
    let previousHash: string | null = null;

    for (let i = 0; i < summaries.length; i++) {
      const summary = summaries[i];

      // Create PlunderRecord from summary
      const record: Omit<PlunderRecord, "hash"> = {
        sequence: i + 1,
        timestamp: new Date().toISOString(),
        operation: "compaction_summary" as OperationType,
        data: {
          timeRange: summary.timeRange,
          aggregatedOperations: summary.aggregatedOperations,
          recordCount: summary.recordCount,
          criticalFindings: summary.criticalFindings,
        },
        previousHash,
      };

      // Compute hash
      const dataToHash = JSON.stringify({
        sequence: record.sequence,
        timestamp: record.timestamp,
        operation: record.operation,
        data: record.data,
        previousHash: record.previousHash,
      });
      const hash = createHash("sha256").update(dataToHash).digest("hex");

      // Add complete record
      records.push({ ...record, hash });
      previousHash = hash;
    }

    return records;
  }
}
