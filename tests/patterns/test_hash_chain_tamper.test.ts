/**
 * Hash Chain Pattern - Tamper Detection Tests
 *
 * Pattern Contract:
 * 1. SHA-256 algorithm used
 * 2. Each record includes hash of previous record
 * 3. First record has previousHash = null
 * 4. Hash computed over deterministic input
 * 5. Chain can be verified independently
 * 6. Tampering breaks chain verification
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { Corsair, type RaidOptions, type CognitoSnapshot, type PlunderRecord } from "../../src/corsair-mvp";

const TEST_EVIDENCE_PATH = "/tmp/test-hash-chain.jsonl";

const mockSnapshot: CognitoSnapshot = {
  userPoolId: "us-east-1_HashTest",
  userPoolName: "HashTestPool",
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
};

describe("Hash Chain Pattern - Cryptographic Compliance", () => {
  let corsair: Corsair;
  const raidOptions: RaidOptions = { vector: "mfa-bypass", intensity: 5, dryRun: true };

  beforeEach(() => {
    corsair = new Corsair({ evidencePath: TEST_EVIDENCE_PATH });
    corsair.resetEvidence();
    if (existsSync(TEST_EVIDENCE_PATH)) {
      unlinkSync(TEST_EVIDENCE_PATH);
    }
  });

  afterEach(() => {
    if (existsSync(TEST_EVIDENCE_PATH)) {
      unlinkSync(TEST_EVIDENCE_PATH);
    }
  });

  it("should use SHA-256 for hash computation", async () => {
    const raidResult = await corsair.raid(mockSnapshot, raidOptions);
    await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);

    const content = readFileSync(TEST_EVIDENCE_PATH, "utf-8");
    const lines = content.trim().split("\n");
    const firstRecord: PlunderRecord = JSON.parse(lines[0]);

    // SHA-256 produces 64-character hex string
    expect(firstRecord.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should have previousHash = null for first record", async () => {
    const raidResult = await corsair.raid(mockSnapshot, raidOptions);
    await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);

    const content = readFileSync(TEST_EVIDENCE_PATH, "utf-8");
    const lines = content.trim().split("\n");
    const firstRecord: PlunderRecord = JSON.parse(lines[0]);

    expect(firstRecord.previousHash).toBeNull();
  });

  it("should link each record to previous hash", async () => {
    const raidResult = await corsair.raid(mockSnapshot, raidOptions);
    await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);

    const content = readFileSync(TEST_EVIDENCE_PATH, "utf-8");
    const lines = content.trim().split("\n");

    for (let i = 1; i < lines.length; i++) {
      const current: PlunderRecord = JSON.parse(lines[i]);
      const previous: PlunderRecord = JSON.parse(lines[i - 1]);

      // Current record's previousHash should match previous record's hash
      expect(current.previousHash).toBe(previous.hash);
    }
  });

  it("should compute hash deterministically", async () => {
    const raidResult = await corsair.raid(mockSnapshot, raidOptions);
    await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);

    const content = readFileSync(TEST_EVIDENCE_PATH, "utf-8");
    const lines = content.trim().split("\n");
    const record: PlunderRecord = JSON.parse(lines[0]);

    // Recompute hash from record data
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

  it("should verify valid chain as valid", async () => {
    const raidResult = await corsair.raid(mockSnapshot, raidOptions);
    await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);

    const verification = corsair.verifyEvidenceChain(TEST_EVIDENCE_PATH);

    expect(verification.valid).toBe(true);
    expect(verification.brokenAt).toBeNull();
    expect(verification.recordCount).toBeGreaterThan(0);
  });

  it("should detect tampering with data field", async () => {
    const raidResult = await corsair.raid(mockSnapshot, raidOptions);
    await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);

    // Tamper with the file
    const content = readFileSync(TEST_EVIDENCE_PATH, "utf-8");
    const lines = content.trim().split("\n");
    const record: PlunderRecord = JSON.parse(lines[1]);

    // Modify data
    record.data = { ...record.data as object, tampered: true };

    // Write tampered file
    lines[1] = JSON.stringify(record);
    writeFileSync(TEST_EVIDENCE_PATH, lines.join("\n") + "\n");

    // Verify should fail
    const verification = corsair.verifyEvidenceChain(TEST_EVIDENCE_PATH);
    expect(verification.valid).toBe(false);
    expect(verification.brokenAt).toBe(2); // Line 2 (1-indexed)
  });

  it("should detect tampering with timestamp", async () => {
    const raidResult = await corsair.raid(mockSnapshot, raidOptions);
    await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);

    const content = readFileSync(TEST_EVIDENCE_PATH, "utf-8");
    const lines = content.trim().split("\n");
    const record: PlunderRecord = JSON.parse(lines[0]);

    // Modify timestamp
    record.timestamp = new Date(Date.now() + 100000).toISOString();

    lines[0] = JSON.stringify(record);
    writeFileSync(TEST_EVIDENCE_PATH, lines.join("\n") + "\n");

    const verification = corsair.verifyEvidenceChain(TEST_EVIDENCE_PATH);
    expect(verification.valid).toBe(false);
    expect(verification.brokenAt).toBe(1);
  });

  it("should detect tampering with sequence number", async () => {
    const raidResult = await corsair.raid(mockSnapshot, raidOptions);
    await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);

    const content = readFileSync(TEST_EVIDENCE_PATH, "utf-8");
    const lines = content.trim().split("\n");
    const record: PlunderRecord = JSON.parse(lines[0]);

    // Modify sequence
    record.sequence = 999;

    lines[0] = JSON.stringify(record);
    writeFileSync(TEST_EVIDENCE_PATH, lines.join("\n") + "\n");

    const verification = corsair.verifyEvidenceChain(TEST_EVIDENCE_PATH);
    expect(verification.valid).toBe(false);
  });

  it("should detect broken previousHash link", async () => {
    const raidResult = await corsair.raid(mockSnapshot, raidOptions);
    await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);

    const content = readFileSync(TEST_EVIDENCE_PATH, "utf-8");
    const lines = content.trim().split("\n");

    if (lines.length > 1) {
      const record: PlunderRecord = JSON.parse(lines[1]);

      // Modify previousHash to wrong value
      record.previousHash = "0000000000000000000000000000000000000000000000000000000000000000";

      lines[1] = JSON.stringify(record);
      writeFileSync(TEST_EVIDENCE_PATH, lines.join("\n") + "\n");

      const verification = corsair.verifyEvidenceChain(TEST_EVIDENCE_PATH);
      expect(verification.valid).toBe(false);
      expect(verification.brokenAt).toBe(2);
    }
  });

  it("should return correct brokenAt index", async () => {
    const raidResult = await corsair.raid(mockSnapshot, raidOptions);
    await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);

    const content = readFileSync(TEST_EVIDENCE_PATH, "utf-8");
    const lines = content.trim().split("\n");

    // Tamper with the last record
    const lastIndex = lines.length - 1;
    const record: PlunderRecord = JSON.parse(lines[lastIndex]);
    record.data = { tampered: "last" };

    lines[lastIndex] = JSON.stringify(record);
    writeFileSync(TEST_EVIDENCE_PATH, lines.join("\n") + "\n");

    const verification = corsair.verifyEvidenceChain(TEST_EVIDENCE_PATH);
    expect(verification.valid).toBe(false);
    expect(verification.brokenAt).toBe(lastIndex + 1); // 1-indexed
  });

  it("should handle empty file as valid", () => {
    // Create empty file
    writeFileSync(TEST_EVIDENCE_PATH, "");

    const verification = corsair.verifyEvidenceChain(TEST_EVIDENCE_PATH);
    expect(verification.valid).toBe(true);
    expect(verification.recordCount).toBe(0);
  });

  it("should verify multiple plunder operations maintain chain", async () => {
    // First raid
    const raidResult1 = await corsair.raid(mockSnapshot, raidOptions);
    await corsair.plunder(raidResult1, TEST_EVIDENCE_PATH);

    // Second raid
    const raidResult2 = await corsair.raid(mockSnapshot, raidOptions);
    await corsair.plunder(raidResult2, TEST_EVIDENCE_PATH);

    // Third raid
    const raidResult3 = await corsair.raid(mockSnapshot, raidOptions);
    await corsair.plunder(raidResult3, TEST_EVIDENCE_PATH);

    // Chain should still be valid across all plunders
    const verification = corsair.verifyEvidenceChain(TEST_EVIDENCE_PATH);
    expect(verification.valid).toBe(true);
    expect(verification.recordCount).toBe(9); // 3 events per raid * 3 raids
  });

  it("should use verifyHashChain convenience method", async () => {
    const raidResult = await corsair.raid(mockSnapshot, raidOptions);
    await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);

    // Convenience method
    const isValid = corsair.verifyHashChain(TEST_EVIDENCE_PATH);
    expect(isValid).toBe(true);
  });
});
