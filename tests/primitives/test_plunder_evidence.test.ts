/**
 * PLUNDER Primitive Test Contract
 *
 * PLUNDER extracts evidence in JSONL format with cryptographic hash chain.
 * It creates tamper-evident audit trail from operations.
 *
 * Contract Requirements:
 * 1. PLUNDER MUST output JSONL format (one JSON object per line)
 * 2. PLUNDER MUST include SHA-256 hash chain (each record references previous)
 * 3. PLUNDER MUST be append-only (no modification of existing records)
 * 4. PLUNDER MUST capture operation context (recon, mark, raid results)
 * 5. PLUNDER MUST include timestamp and sequence number
 * 6. PLUNDER MUST support verification of chain integrity
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Corsair, PlunderRecord } from "../../src/corsair-mvp";
import { readFileSync, existsSync, unlinkSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import {
  compliantSnapshot,
  nonCompliantSnapshot,
} from "../fixtures/mock-snapshots";

describe("PLUNDER Primitive - Evidence Extraction", () => {
  let corsair: Corsair;
  const testEvidencePath = "./tests/test-evidence.jsonl";

  beforeAll(() => {
    corsair = new Corsair({ evidencePath: testEvidencePath });
  });

  afterAll(() => {
    // Clean up test evidence file
    if (existsSync(testEvidencePath)) {
      unlinkSync(testEvidencePath);
    }
  });

  test("PLUNDER creates JSONL formatted output", async () => {
    // Create a raid to plunder
    const raidResult = await corsair.raid(nonCompliantSnapshot, {
      vector: "mfa-bypass",
      intensity: 5,
      dryRun: true,
    });

    const plunderResult = await corsair.plunder(raidResult, testEvidencePath);

    expect(plunderResult).toBeDefined();
    expect(plunderResult.evidencePath).toBe(testEvidencePath);
    expect(plunderResult.eventCount).toBeGreaterThan(0);

    // Verify file content is valid JSONL
    const content = readFileSync(testEvidencePath, "utf-8");
    const lines = content.trim().split("\n");

    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  test("PLUNDER includes SHA-256 hash chain", async () => {
    // Clear and start fresh
    corsair.resetEvidence();

    const raid1 = await corsair.raid(nonCompliantSnapshot, {
      vector: "mfa-bypass",
      intensity: 5,
      dryRun: true,
    });
    await corsair.plunder(raid1, testEvidencePath);

    // Read and parse records
    const content = readFileSync(testEvidencePath, "utf-8");
    const records: PlunderRecord[] = content
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));

    expect(records.length).toBeGreaterThanOrEqual(3); // Plunder creates 3 events per raid

    // First record should have null previousHash
    expect(records[0].previousHash).toBeNull();
    expect(records[0].hash).toBeDefined();
    expect(records[0].hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex

    // Second record should reference first record's hash
    expect(records[1].previousHash).toBe(records[0].hash);
    expect(records[1].hash).not.toBe(records[0].hash);

    // Third record should reference second record's hash
    expect(records[2].previousHash).toBe(records[1].hash);
  });

  test("PLUNDER hash is computed correctly", async () => {
    corsair.resetEvidence();

    const raidResult = await corsair.raid(nonCompliantSnapshot, {
      vector: "mfa-bypass",
      intensity: 5,
      dryRun: true,
    });
    await corsair.plunder(raidResult, testEvidencePath);

    const content = readFileSync(testEvidencePath, "utf-8");
    const firstLine = content.trim().split("\n")[0];
    const record: PlunderRecord = JSON.parse(firstLine);

    // Verify hash computation
    const dataToHash = JSON.stringify({
      sequence: record.sequence,
      timestamp: record.timestamp,
      operation: record.operation,
      data: record.data,
      previousHash: record.previousHash,
    });

    const expectedHash = createHash("sha256").update(dataToHash).digest("hex");
    expect(record.hash).toBe(expectedHash);
  });

  test("PLUNDER is append-only", async () => {
    corsair.resetEvidence();

    // Write first raid
    const raid1 = await corsair.raid(nonCompliantSnapshot, {
      vector: "mfa-bypass",
      intensity: 5,
      dryRun: true,
    });
    await corsair.plunder(raid1, testEvidencePath);

    const contentBefore = readFileSync(testEvidencePath, "utf-8");
    const recordsBefore = contentBefore.trim().split("\n").length;

    // Write second raid
    const raid2 = await corsair.raid(compliantSnapshot, {
      vector: "password-spray",
      intensity: 3,
      dryRun: true,
    });
    await corsair.plunder(raid2, testEvidencePath);

    const contentAfter = readFileSync(testEvidencePath, "utf-8");
    const recordsAfter = contentAfter.trim().split("\n").length;

    // Should have 3 more records (plunder creates 3 events per raid)
    expect(recordsAfter).toBe(recordsBefore + 3);

    // First record should be unchanged
    const linesBefore = contentBefore.trim().split("\n");
    const linesAfter = contentAfter.trim().split("\n");
    expect(linesAfter[0]).toBe(linesBefore[0]);
  });

  test("PLUNDER includes sequence numbers", async () => {
    corsair.resetEvidence();

    // Write multiple raids
    for (let i = 0; i < 2; i++) {
      const raidResult = await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 5,
        dryRun: true,
      });
      await corsair.plunder(raidResult, testEvidencePath);
    }

    const content = readFileSync(testEvidencePath, "utf-8");
    const records: PlunderRecord[] = content
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));

    expect(records.length).toBe(6); // 2 raids * 3 events each

    for (let i = 0; i < records.length; i++) {
      expect(records[i].sequence).toBe(i + 1);
    }
  });

  test("PLUNDER captures different operation types", async () => {
    corsair.resetEvidence();

    // Raid operation
    const raidResult = await corsair.raid(nonCompliantSnapshot, {
      vector: "mfa-bypass",
      intensity: 5,
      dryRun: true,
    });
    await corsair.plunder(raidResult, testEvidencePath);

    const content = readFileSync(testEvidencePath, "utf-8");
    const records: PlunderRecord[] = content
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));

    const operations = records.map((r) => r.operation);
    expect(operations).toContain("raid_initiated");
    expect(operations).toContain("raid_executed");
    expect(operations).toContain("raid_completed");
  });

  test("PLUNDER verifies chain integrity", async () => {
    corsair.resetEvidence();

    // Write some records
    const raid1 = await corsair.raid(nonCompliantSnapshot, {
      vector: "mfa-bypass",
      intensity: 5,
      dryRun: true,
    });
    await corsair.plunder(raid1, testEvidencePath);

    // Verify chain
    const verifyResult = corsair.verifyEvidenceChain(testEvidencePath);

    expect(verifyResult.valid).toBe(true);
    expect(verifyResult.recordCount).toBe(3); // 3 events per raid
    expect(verifyResult.brokenAt).toBeNull();
  });

  test("PLUNDER detects tampered chain", async () => {
    corsair.resetEvidence();

    // Write some records
    const raid1 = await corsair.raid(nonCompliantSnapshot, {
      vector: "mfa-bypass",
      intensity: 5,
      dryRun: true,
    });
    await corsair.plunder(raid1, testEvidencePath);

    // Tamper with the file - modify first record
    const content = readFileSync(testEvidencePath, "utf-8");
    const lines = content.trim().split("\n");
    const record1 = JSON.parse(lines[0]);
    record1.data.raidId = "TAMPERED";
    lines[0] = JSON.stringify(record1);

    // Write tampered content
    writeFileSync(testEvidencePath, lines.join("\n") + "\n");

    // Verify should detect tampering
    const verifyResult = corsair.verifyEvidenceChain(testEvidencePath);

    expect(verifyResult.valid).toBe(false);
    expect(verifyResult.brokenAt).toBe(1); // First record (index 0) has invalid hash
  });

  test("PLUNDER records include ISO timestamps", async () => {
    corsair.resetEvidence();

    const raidResult = await corsair.raid(nonCompliantSnapshot, {
      vector: "mfa-bypass",
      intensity: 5,
      dryRun: true,
    });
    await corsair.plunder(raidResult, testEvidencePath);

    const content = readFileSync(testEvidencePath, "utf-8");
    const firstLine = content.trim().split("\n")[0];
    const record: PlunderRecord = JSON.parse(firstLine);

    // Verify ISO 8601 format
    expect(record.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    expect(new Date(record.timestamp).toISOString()).toBe(record.timestamp);
  });
});
