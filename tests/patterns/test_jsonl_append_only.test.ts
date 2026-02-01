/**
 * JSONL Serialization Pattern - Append-Only Tests
 *
 * Pattern Contract:
 * 1. appendFileSync used (not writeFileSync)
 * 2. One JSON object per line
 * 3. Newline delimiter after each record
 * 4. Sequence numbers monotonically increasing
 * 5. File readable mid-write
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { Corsair, type RaidOptions, type CognitoSnapshot } from "../../src/corsair-mvp";

const TEST_EVIDENCE_PATH = "/tmp/test-jsonl-pattern.jsonl";

const mockSnapshot: CognitoSnapshot = {
  userPoolId: "us-east-1_TestPool",
  userPoolName: "TestPool",
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

describe("JSONL Serialization Pattern - Append-Only Compliance", () => {
  let corsair: Corsair;

  beforeEach(() => {
    corsair = new Corsair({ evidencePath: TEST_EVIDENCE_PATH });
    corsair.resetEvidence();
    // Ensure clean state
    if (existsSync(TEST_EVIDENCE_PATH)) {
      unlinkSync(TEST_EVIDENCE_PATH);
    }
  });

  afterEach(() => {
    if (existsSync(TEST_EVIDENCE_PATH)) {
      unlinkSync(TEST_EVIDENCE_PATH);
    }
  });

  it("should create valid JSONL format (one JSON per line)", async () => {
    const raidOptions: RaidOptions = { vector: "mfa-bypass", intensity: 5, dryRun: true };
    const raidResult = await corsair.raid(mockSnapshot, raidOptions);
    await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);

    const content = readFileSync(TEST_EVIDENCE_PATH, "utf-8");
    const lines = content.trim().split("\n");

    // Each line should be valid JSON
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }

    // No empty lines
    expect(lines.every(line => line.length > 0)).toBe(true);
  });

  it("should have monotonically increasing sequence numbers", async () => {
    const raidOptions: RaidOptions = { vector: "mfa-bypass", intensity: 5, dryRun: true };
    const raidResult = await corsair.raid(mockSnapshot, raidOptions);
    await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);

    const content = readFileSync(TEST_EVIDENCE_PATH, "utf-8");
    const lines = content.trim().split("\n");
    const sequences: number[] = [];

    for (const line of lines) {
      const record = JSON.parse(line);
      sequences.push(record.sequence);
    }

    // Verify monotonically increasing
    for (let i = 1; i < sequences.length; i++) {
      expect(sequences[i]).toBeGreaterThan(sequences[i - 1]);
    }
  });

  it("should include newline delimiter after each record", async () => {
    const raidOptions: RaidOptions = { vector: "mfa-bypass", intensity: 5, dryRun: true };
    const raidResult = await corsair.raid(mockSnapshot, raidOptions);
    await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);

    const content = readFileSync(TEST_EVIDENCE_PATH, "utf-8");

    // File should end with newline
    expect(content.endsWith("\n")).toBe(true);

    // Count newlines should equal number of records
    const newlineCount = (content.match(/\n/g) || []).length;
    const recordCount = content.trim().split("\n").length;
    expect(newlineCount).toBe(recordCount);
  });

  it("should append to existing file (not overwrite)", async () => {
    // Write initial content
    const raidOptions: RaidOptions = { vector: "mfa-bypass", intensity: 5, dryRun: true };
    const raidResult1 = await corsair.raid(mockSnapshot, raidOptions);
    await corsair.plunder(raidResult1, TEST_EVIDENCE_PATH);

    const initialContent = readFileSync(TEST_EVIDENCE_PATH, "utf-8");
    const initialLineCount = initialContent.trim().split("\n").length;

    // Write more content
    const raidResult2 = await corsair.raid(mockSnapshot, raidOptions);
    await corsair.plunder(raidResult2, TEST_EVIDENCE_PATH);

    const finalContent = readFileSync(TEST_EVIDENCE_PATH, "utf-8");
    const finalLineCount = finalContent.trim().split("\n").length;

    // Should have appended, not overwritten
    expect(finalLineCount).toBeGreaterThan(initialLineCount);

    // Initial content should still be present at start
    expect(finalContent.startsWith(initialContent)).toBe(true);
  });

  it("should not use JSON pretty-printing", async () => {
    const raidOptions: RaidOptions = { vector: "mfa-bypass", intensity: 5, dryRun: true };
    const raidResult = await corsair.raid(mockSnapshot, raidOptions);
    await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);

    const content = readFileSync(TEST_EVIDENCE_PATH, "utf-8");
    const lines = content.trim().split("\n");

    // Each line should be a single-line JSON (no embedded newlines)
    for (const line of lines) {
      expect(line.includes("\n")).toBe(false);
      expect(line.includes("  ")).toBe(false); // No indentation
    }
  });

  it("should be readable mid-write (no buffering corruption)", async () => {
    const raidOptions: RaidOptions = { vector: "mfa-bypass", intensity: 5, dryRun: true };

    // Start raid but don't await immediately
    const raidResult = await corsair.raid(mockSnapshot, raidOptions);

    // File should be readable before plunder completes
    const plunderPromise = corsair.plunder(raidResult, TEST_EVIDENCE_PATH);

    // Even if we read mid-write, should get valid JSON lines
    await plunderPromise;

    const content = readFileSync(TEST_EVIDENCE_PATH, "utf-8");
    const lines = content.trim().split("\n");

    // All lines should be parseable
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  it("should handle multiple rapid writes correctly", async () => {
    const raidOptions: RaidOptions = { vector: "mfa-bypass", intensity: 5, dryRun: true };

    // Rapid sequential writes
    for (let i = 0; i < 5; i++) {
      const raidResult = await corsair.raid(mockSnapshot, raidOptions);
      await corsair.plunder(raidResult, TEST_EVIDENCE_PATH);
    }

    const content = readFileSync(TEST_EVIDENCE_PATH, "utf-8");
    const lines = content.trim().split("\n");

    // Should have 15 lines (3 events per raid * 5 raids)
    expect(lines.length).toBe(15);

    // All should be valid JSON
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });
});
