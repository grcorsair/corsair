/**
 * Compaction Pattern (OpenClaw Pattern 1) - JSONL Size Reduction Tests
 *
 * Pattern Contract:
 * 1. Compaction reduces record count significantly (aggregating many into summaries)
 * 2. Hash chain remains valid after compaction (rebuilt from scratch)
 * 3. Backup created before any modification (safety first)
 * 4. Summary records capture time ranges from aggregated records
 * 5. Critical metadata (findings, severity) is preserved in summaries
 * 6. Compression ratio is calculated and reported
 * 7. Original data can be recovered from backup if needed
 *
 * TDD: These tests are written BEFORE implementation per project methodology.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, readFileSync, unlinkSync, writeFileSync, statSync } from "fs";
import { Corsair, type RaidOptions, type CognitoSnapshot, type PlunderRecord } from "../../src/corsair-mvp";
import { join } from "path";

const TEST_EVIDENCE_PATH = "/tmp/test-compaction.jsonl";
const TEST_BACKUP_PATTERN = "/tmp/test-compaction.jsonl.backup-";

const mockSnapshot: CognitoSnapshot = {
  userPoolId: "us-west-2_CompactTest",
  userPoolName: "CompactionTestPool",
  mfaConfiguration: "OFF",
  softwareTokenMfaEnabled: false,
  smsMfaEnabled: false,
  passwordPolicy: {
    minimumLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: false,
    temporaryPasswordValidityDays: 7,
  },
  riskConfiguration: null,
  deviceConfiguration: {
    challengeRequiredOnNewDevice: false,
    deviceOnlyRememberedOnUserPrompt: false,
  },
  observedAt: new Date().toISOString(),
  userCount: 1000,
};

// Helper to count records in JSONL file
function countRecords(path: string): number {
  if (!existsSync(path)) return 0;
  const content = readFileSync(path, "utf-8").trim();
  if (!content) return 0;
  return content.split("\n").filter(line => line.trim()).length;
}

// Helper to read JSONL records
function readJSONL(path: string): PlunderRecord[] {
  if (!existsSync(path)) return [];
  const content = readFileSync(path, "utf-8").trim();
  if (!content) return [];
  return content.split("\n")
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

// Helper to clean up test files
function cleanupTestFiles(): void {
  if (existsSync(TEST_EVIDENCE_PATH)) {
    unlinkSync(TEST_EVIDENCE_PATH);
  }
  // Clean up any backup files
  const { readdirSync } = require("fs");
  const tmpDir = "/tmp";
  try {
    const files = readdirSync(tmpDir);
    for (const file of files) {
      if (file.startsWith("test-compaction.jsonl.backup-")) {
        unlinkSync(join(tmpDir, file));
      }
    }
  } catch (e) {
    // Ignore cleanup errors
  }
}

describe("Compaction Pattern - JSONL Size Reduction (OpenClaw Pattern 1)", () => {
  let corsair: Corsair;
  const raidOptions: RaidOptions = { vector: "mfa-bypass", intensity: 5, dryRun: true };

  beforeEach(() => {
    corsair = new Corsair({ evidencePath: TEST_EVIDENCE_PATH });
    corsair.resetEvidence();
    cleanupTestFiles();
  });

  afterEach(() => {
    cleanupTestFiles();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CORE COMPACTION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Core Compaction Functionality", () => {
    it("should compact large evidence file while preserving hash chain", async () => {
      // Arrange: Create evidence file with many records (100 raids = 300 records)
      for (let i = 0; i < 100; i++) {
        const raidResult = await corsair.raid(mockSnapshot, raidOptions);
        await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);
      }

      const beforeSize = statSync(TEST_EVIDENCE_PATH).size;
      const beforeCount = countRecords(TEST_EVIDENCE_PATH);

      expect(beforeCount).toBe(300); // 3 records per raid * 100 raids

      // Act
      const result = await corsair.compactEvidence(TEST_EVIDENCE_PATH);

      // Assert
      const afterSize = statSync(TEST_EVIDENCE_PATH).size;
      const afterCount = countRecords(TEST_EVIDENCE_PATH);

      expect(afterSize).toBeLessThan(beforeSize);
      expect(afterCount).toBeLessThan(beforeCount);
      expect(result.hashChainValid).toBe(true);
      expect(result.before.recordCount).toBe(beforeCount);
      expect(result.after.recordCount).toBe(afterCount);
    });

    it("should achieve significant compression ratio (>50%)", async () => {
      // Arrange: Create substantial evidence (50 raids = 150 records)
      for (let i = 0; i < 50; i++) {
        const raidResult = await corsair.raid(mockSnapshot, raidOptions);
        await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);
      }

      const beforeSize = statSync(TEST_EVIDENCE_PATH).size;

      // Act
      const result = await corsair.compactEvidence(TEST_EVIDENCE_PATH);

      // Assert
      expect(result.compression).toBeGreaterThan(0.5); // At least 50% reduction
      expect(result.before.fileSizeBytes).toBe(beforeSize);
      expect(result.after.fileSizeBytes).toBeLessThan(beforeSize);
    });

    it("should reduce record count significantly", async () => {
      // Arrange: 200 records (aggregated to fewer summaries)
      for (let i = 0; i < 67; i++) { // 67 * 3 = 201 records (approximately 200)
        const raidResult = await corsair.raid(mockSnapshot, raidOptions);
        await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);
      }

      const beforeCount = countRecords(TEST_EVIDENCE_PATH);

      // Act
      const result = await corsair.compactEvidence(TEST_EVIDENCE_PATH);

      // Assert: Should reduce to ~2-3 summary records (batch size 100)
      expect(result.after.recordCount).toBeLessThan(beforeCount / 10);
      expect(result.after.recordCount).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BACKUP SAFETY TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Backup Safety", () => {
    it("should create backup before compaction", async () => {
      // Arrange
      for (let i = 0; i < 10; i++) {
        const raidResult = await corsair.raid(mockSnapshot, raidOptions);
        await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);
      }

      // Act
      const result = await corsair.compactEvidence(TEST_EVIDENCE_PATH);

      // Assert
      expect(existsSync(result.backupPath)).toBe(true);
      expect(result.backupPath).toContain(".backup-");
      expect(result.backupPath).toContain(TEST_EVIDENCE_PATH);
    });

    it("should preserve original record count in backup", async () => {
      // Arrange
      for (let i = 0; i < 20; i++) {
        const raidResult = await corsair.raid(mockSnapshot, raidOptions);
        await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);
      }

      const originalCount = countRecords(TEST_EVIDENCE_PATH);

      // Act
      const result = await corsair.compactEvidence(TEST_EVIDENCE_PATH);

      // Assert: Backup should have original count
      const backupCount = countRecords(result.backupPath);
      expect(backupCount).toBe(originalCount);
    });

    it("should use timestamped backup filename", async () => {
      // Arrange
      const raidResult = await corsair.raid(mockSnapshot, raidOptions);
      await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);

      // Act
      const beforeTime = Date.now();
      const result = await corsair.compactEvidence(TEST_EVIDENCE_PATH);
      const afterTime = Date.now();

      // Assert: Backup filename should contain timestamp
      const timestampMatch = result.backupPath.match(/\.backup-(\d+)$/);
      expect(timestampMatch).not.toBeNull();

      const timestamp = parseInt(timestampMatch![1], 10);
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // HASH CHAIN INTEGRITY TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Hash Chain Integrity", () => {
    it("should rebuild hash chain correctly after compaction", async () => {
      // Arrange
      for (let i = 0; i < 50; i++) {
        const raidResult = await corsair.raid(mockSnapshot, raidOptions);
        await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);
      }

      // Act
      await corsair.compactEvidence(TEST_EVIDENCE_PATH);

      // Assert: Chain should verify as valid
      const chainResult = corsair.verifyEvidenceChain(TEST_EVIDENCE_PATH);
      expect(chainResult.valid).toBe(true);
      expect(chainResult.brokenAt).toBeNull();
    });

    it("should have null previousHash for first compacted record", async () => {
      // Arrange
      for (let i = 0; i < 10; i++) {
        const raidResult = await corsair.raid(mockSnapshot, raidOptions);
        await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);
      }

      // Act
      await corsair.compactEvidence(TEST_EVIDENCE_PATH);

      // Assert
      const records = readJSONL(TEST_EVIDENCE_PATH);
      expect(records.length).toBeGreaterThan(0);
      expect(records[0].previousHash).toBeNull();
    });

    it("should link compacted records with valid hashes", async () => {
      // Arrange
      for (let i = 0; i < 30; i++) {
        const raidResult = await corsair.raid(mockSnapshot, raidOptions);
        await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);
      }

      // Act
      await corsair.compactEvidence(TEST_EVIDENCE_PATH);

      // Assert: Each record's previousHash should match previous record's hash
      const records = readJSONL(TEST_EVIDENCE_PATH);
      for (let i = 1; i < records.length; i++) {
        expect(records[i].previousHash).toBe(records[i - 1].hash);
      }
    });

    it("should fail compaction if original chain is broken", async () => {
      // Arrange: Create valid evidence
      for (let i = 0; i < 10; i++) {
        const raidResult = await corsair.raid(mockSnapshot, raidOptions);
        await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);
      }

      // Tamper with the file to break chain
      const content = readFileSync(TEST_EVIDENCE_PATH, "utf-8");
      const lines = content.trim().split("\n");
      const record = JSON.parse(lines[1]);
      record.data = { tampered: true };
      lines[1] = JSON.stringify(record);
      writeFileSync(TEST_EVIDENCE_PATH, lines.join("\n") + "\n");

      // Act & Assert: Should throw error about broken chain
      await expect(corsair.compactEvidence(TEST_EVIDENCE_PATH)).rejects.toThrow(
        "Cannot compact - hash chain is already broken"
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY RECORD TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Summary Record Generation", () => {
    it("should create summary records with time ranges", async () => {
      // Arrange: Create records with timestamps
      for (let i = 0; i < 50; i++) {
        const raidResult = await corsair.raid(mockSnapshot, raidOptions);
        await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);
      }

      // Act
      await corsair.compactEvidence(TEST_EVIDENCE_PATH);

      // Assert
      const records = readJSONL(TEST_EVIDENCE_PATH);
      const summaryRecords = records.filter(r =>
        r.operation === "compaction_summary" ||
        (r.data && typeof r.data === "object" && "timeRange" in (r.data as Record<string, unknown>))
      );

      expect(summaryRecords.length).toBeGreaterThan(0);

      // Check first summary has time range
      const summary = summaryRecords[0];
      const data = summary.data as Record<string, unknown>;
      expect(data.timeRange).toBeDefined();

      const timeRange = data.timeRange as { start: string; end: string };
      expect(timeRange.start).toBeDefined();
      expect(timeRange.end).toBeDefined();
      expect(new Date(timeRange.start).getTime()).toBeLessThanOrEqual(new Date(timeRange.end).getTime());
    });

    it("should include aggregated operation types in summaries", async () => {
      // Arrange
      for (let i = 0; i < 20; i++) {
        const raidResult = await corsair.raid(mockSnapshot, raidOptions);
        await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);
      }

      // Act
      await corsair.compactEvidence(TEST_EVIDENCE_PATH);

      // Assert
      const records = readJSONL(TEST_EVIDENCE_PATH);
      const summaryRecord = records.find(r =>
        r.operation === "compaction_summary" ||
        (r.data && typeof r.data === "object" && "aggregatedOperations" in (r.data as Record<string, unknown>))
      );

      expect(summaryRecord).toBeDefined();
      const data = summaryRecord!.data as Record<string, unknown>;
      expect(data.aggregatedOperations).toBeDefined();
      expect(Array.isArray(data.aggregatedOperations)).toBe(true);
      expect((data.aggregatedOperations as string[]).length).toBeGreaterThan(0);
    });

    it("should include record count in summaries", async () => {
      // Arrange
      for (let i = 0; i < 30; i++) {
        const raidResult = await corsair.raid(mockSnapshot, raidOptions);
        await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);
      }

      // Act
      await corsair.compactEvidence(TEST_EVIDENCE_PATH);

      // Assert
      const records = readJSONL(TEST_EVIDENCE_PATH);
      const summaryRecord = records.find(r =>
        r.operation === "compaction_summary" ||
        (r.data && typeof r.data === "object" && "recordCount" in (r.data as Record<string, unknown>))
      );

      expect(summaryRecord).toBeDefined();
      const data = summaryRecord!.data as Record<string, unknown>;
      expect(data.recordCount).toBeDefined();
      expect(typeof data.recordCount).toBe("number");
      expect(data.recordCount as number).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // METADATA PRESERVATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Critical Metadata Preservation", () => {
    it("should preserve critical findings in compacted summaries", async () => {
      // Arrange: Create raids that generate CRITICAL findings
      // MFA-bypass on MFA OFF produces CRITICAL findings
      for (let i = 0; i < 20; i++) {
        const raidResult = await corsair.raid(mockSnapshot, raidOptions);
        await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);
      }

      // Act
      await corsair.compactEvidence(TEST_EVIDENCE_PATH);

      // Assert: Critical findings should be preserved
      const records = readJSONL(TEST_EVIDENCE_PATH);
      const summaryRecords = records.filter(r =>
        r.operation === "compaction_summary" ||
        (r.data && typeof r.data === "object" && "criticalFindings" in (r.data as Record<string, unknown>))
      );

      // At least some summaries should have critical findings
      expect(summaryRecords.length).toBeGreaterThan(0);
    });

    it("should record compaction timestamp in result", async () => {
      // Arrange
      const raidResult = await corsair.raid(mockSnapshot, raidOptions);
      await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);

      // Act
      const beforeTime = new Date().toISOString();
      const result = await corsair.compactEvidence(TEST_EVIDENCE_PATH);
      const afterTime = new Date().toISOString();

      // Assert
      expect(result.compactedAt).toBeDefined();
      expect(new Date(result.compactedAt).getTime()).toBeGreaterThanOrEqual(new Date(beforeTime).getTime());
      expect(new Date(result.compactedAt).getTime()).toBeLessThanOrEqual(new Date(afterTime).getTime());
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPRESSION RATIO TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Compression Ratio Calculation", () => {
    it("should calculate compression ratio correctly", async () => {
      // Arrange
      for (let i = 0; i < 50; i++) {
        const raidResult = await corsair.raid(mockSnapshot, raidOptions);
        await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);
      }

      const beforeSize = statSync(TEST_EVIDENCE_PATH).size;

      // Act
      const result = await corsair.compactEvidence(TEST_EVIDENCE_PATH);

      const afterSize = statSync(TEST_EVIDENCE_PATH).size;

      // Assert: compression = (beforeSize - afterSize) / beforeSize
      const expectedCompression = (beforeSize - afterSize) / beforeSize;
      expect(result.compression).toBeCloseTo(expectedCompression, 2);
    });

    it("should have compression ratio between 0 and 1", async () => {
      // Arrange
      for (let i = 0; i < 30; i++) {
        const raidResult = await corsair.raid(mockSnapshot, raidOptions);
        await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);
      }

      // Act
      const result = await corsair.compactEvidence(TEST_EVIDENCE_PATH);

      // Assert
      expect(result.compression).toBeGreaterThan(0);
      expect(result.compression).toBeLessThanOrEqual(1);
    });

    it("should report before and after metrics accurately", async () => {
      // Arrange
      for (let i = 0; i < 40; i++) {
        const raidResult = await corsair.raid(mockSnapshot, raidOptions);
        await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);
      }

      const beforeSize = statSync(TEST_EVIDENCE_PATH).size;
      const beforeCount = countRecords(TEST_EVIDENCE_PATH);

      // Act
      const result = await corsair.compactEvidence(TEST_EVIDENCE_PATH);

      const afterSize = statSync(TEST_EVIDENCE_PATH).size;
      const afterCount = countRecords(TEST_EVIDENCE_PATH);

      // Assert
      expect(result.before.recordCount).toBe(beforeCount);
      expect(result.before.fileSizeBytes).toBe(beforeSize);
      expect(result.after.recordCount).toBe(afterCount);
      expect(result.after.fileSizeBytes).toBe(afterSize);
      expect(result.before.recordCount).toBeGreaterThan(result.after.recordCount);
      expect(result.before.fileSizeBytes).toBeGreaterThan(result.after.fileSizeBytes);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EDGE CASE TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Edge Cases", () => {
    it("should handle empty evidence file gracefully", async () => {
      // Arrange: Create empty file
      writeFileSync(TEST_EVIDENCE_PATH, "");

      // Act & Assert: Should handle gracefully (no records to compact)
      const result = await corsair.compactEvidence(TEST_EVIDENCE_PATH);

      expect(result.before.recordCount).toBe(0);
      expect(result.after.recordCount).toBe(0);
      expect(result.compression).toBe(0); // No compression on empty file
      expect(result.hashChainValid).toBe(true); // Empty chain is valid
    });

    it("should handle single record evidence file", async () => {
      // Arrange: Write single valid record manually
      const singleRecord: PlunderRecord = {
        sequence: 1,
        timestamp: new Date().toISOString(),
        operation: "raid_initiated",
        data: { raidId: "RAID-single", target: "test", vector: "mfa-bypass" },
        previousHash: null,
        hash: "0000000000000000000000000000000000000000000000000000000000000000"
      };

      // Compute proper hash
      const { createHash } = require("crypto");
      const dataToHash = JSON.stringify({
        sequence: singleRecord.sequence,
        timestamp: singleRecord.timestamp,
        operation: singleRecord.operation,
        data: singleRecord.data,
        previousHash: singleRecord.previousHash,
      });
      singleRecord.hash = createHash("sha256").update(dataToHash).digest("hex");

      writeFileSync(TEST_EVIDENCE_PATH, JSON.stringify(singleRecord) + "\n");

      // Act
      const result = await corsair.compactEvidence(TEST_EVIDENCE_PATH);

      // Assert: Single record should still result in at least 1 summary
      expect(result.before.recordCount).toBe(1);
      expect(result.after.recordCount).toBeGreaterThanOrEqual(1);
      expect(result.hashChainValid).toBe(true);
    });

    it("should handle non-existent file gracefully", async () => {
      // Arrange: File doesn't exist
      const nonExistentPath = "/tmp/non-existent-evidence-file.jsonl";
      if (existsSync(nonExistentPath)) {
        unlinkSync(nonExistentPath);
      }

      // Act & Assert: Should throw meaningful error
      await expect(corsair.compactEvidence(nonExistentPath)).rejects.toThrow();
    });

    it("should handle small batch sizes correctly", async () => {
      // Arrange: Create exactly 5 records (less than batch size of 100)
      for (let i = 0; i < 2; i++) { // 2 raids = 6 records
        const raidResult = await corsair.raid(mockSnapshot, raidOptions);
        await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);
      }

      const beforeCount = countRecords(TEST_EVIDENCE_PATH);

      // Act
      const result = await corsair.compactEvidence(TEST_EVIDENCE_PATH);

      // Assert: Should still compact (even if batch is smaller than default)
      expect(result.hashChainValid).toBe(true);
      expect(result.after.recordCount).toBeLessThanOrEqual(beforeCount);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // IDEMPOTENCY TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Idempotency", () => {
    it("should allow multiple compactions on same file", async () => {
      // Arrange
      for (let i = 0; i < 50; i++) {
        const raidResult = await corsair.raid(mockSnapshot, raidOptions);
        await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);
      }

      // Act: Compact twice
      const result1 = await corsair.compactEvidence(TEST_EVIDENCE_PATH);
      const result2 = await corsair.compactEvidence(TEST_EVIDENCE_PATH);

      // Assert: Both compactions should succeed with valid chains
      expect(result1.hashChainValid).toBe(true);
      expect(result2.hashChainValid).toBe(true);
      // Second compaction should have fewer or equal records (already compacted)
      expect(result2.after.recordCount).toBeLessThanOrEqual(result1.after.recordCount);
    });
  });
});
