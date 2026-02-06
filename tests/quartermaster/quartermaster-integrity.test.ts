/**
 * Quartermaster Integrity Tests
 *
 * Tests deterministic checks in the Quartermaster agent:
 * - Evidence hash chain verification
 * - Timestamp consistency
 * - RAID-PLUNDER correlation
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, unlinkSync, rmSync } from "fs";
import { createHash } from "crypto";
import { QuartermasterAgent } from "../../src/quartermaster/quartermaster-agent";
import type { QuartermasterInput, QuartermasterConfig } from "../../src/quartermaster/quartermaster-types";
import type { MarkResult, RaidResult, ChartResult } from "../../src/corsair-mvp";

const TEST_DIR = "/tmp/quartermaster-integrity-test";
const TEST_EVIDENCE = `${TEST_DIR}/evidence.jsonl`;

function makeHash(record: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(record)).digest("hex");
}

function writeValidEvidence(path: string, count: number = 3): void {
  const dir = path.substring(0, path.lastIndexOf("/"));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  let previousHash: string | null = null;
  const lines: string[] = [];

  for (let i = 0; i < count; i++) {
    const record = {
      sequence: i + 1,
      timestamp: new Date(Date.now() + i * 1000).toISOString(),
      operation: "raid_executed",
      data: { raidId: `raid-${i}`, success: false, controlsHeld: true },
      previousHash,
    };
    const hash = makeHash(record);
    lines.push(JSON.stringify({ ...record, hash }));
    previousHash = hash;
  }

  writeFileSync(path, lines.join("\n") + "\n");
}

function writeBrokenEvidence(path: string): void {
  const dir = path.substring(0, path.lastIndexOf("/"));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const record1 = {
    sequence: 1,
    timestamp: new Date().toISOString(),
    operation: "raid_initiated",
    data: { raidId: "raid-1" },
    previousHash: null,
  };
  const hash1 = makeHash(record1);

  // Record 2 has wrong previousHash (broken chain)
  const record2 = {
    sequence: 2,
    timestamp: new Date(Date.now() + 1000).toISOString(),
    operation: "raid_executed",
    data: { raidId: "raid-1", success: true },
    previousHash: "wrong-hash-value",
  };
  const hash2 = makeHash(record2);

  const lines = [
    JSON.stringify({ ...record1, hash: hash1 }),
    JSON.stringify({ ...record2, hash: hash2 }),
  ];

  writeFileSync(path, lines.join("\n") + "\n");
}

function makeMinimalInput(overrides: Partial<QuartermasterInput> = {}): QuartermasterInput {
  return {
    evidencePaths: [TEST_EVIDENCE],
    markResults: [],
    raidResults: [],
    chartResults: [],
    scope: { providers: ["aws-cognito"], resourceCount: 1 },
    ...overrides,
  };
}

function makeRaidResult(id: string, success: boolean = false): RaidResult {
  return {
    raidId: id,
    target: "test-pool",
    vector: "weak-password" as any,
    success,
    controlsHeld: !success,
    findings: success ? ["Control bypassed"] : [],
    durationMs: 100,
    serialized: `RAID[${id}]`,
    timeline: [],
  };
}

function makeMarkResult(): MarkResult {
  return {
    findings: [
      {
        field: "mfaConfiguration",
        expected: "ON",
        actual: "OFF",
        drift: true,
        severity: "CRITICAL" as any,
        timestamp: new Date().toISOString(),
      },
    ],
    driftDetected: true,
    checkedAt: new Date().toISOString(),
  };
}

describe("Quartermaster Deterministic Integrity Checks", () => {
  let quartermaster: QuartermasterAgent;
  const config: QuartermasterConfig = {
    apiKey: "test-key",
    model: "claude-sonnet-4-5-20250929",
  };

  beforeEach(() => {
    quartermaster = new QuartermasterAgent(config);
    if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  test("Valid hash chain scores 100 for evidence integrity", () => {
    writeValidEvidence(TEST_EVIDENCE, 6);
    const input = makeMinimalInput();
    const result = quartermaster.checkEvidenceIntegrity(input);

    expect(result.score).toBe(100);
    expect(result.findings.filter((f) => f.severity === "critical")).toHaveLength(0);
  });

  test("Broken hash chain scores <= 70 and generates critical finding", () => {
    writeBrokenEvidence(TEST_EVIDENCE);
    const input = makeMinimalInput();
    const result = quartermaster.checkEvidenceIntegrity(input);

    expect(result.score).toBeLessThanOrEqual(70);
    const criticals = result.findings.filter((f) => f.severity === "critical");
    expect(criticals.length).toBeGreaterThanOrEqual(1);
    expect(criticals[0].category).toBe("evidence_integrity");
  });

  test("Missing evidence file generates critical finding", () => {
    const input = makeMinimalInput({
      evidencePaths: ["/nonexistent/path/evidence.jsonl"],
    });
    const result = quartermaster.checkEvidenceIntegrity(input);

    const criticals = result.findings.filter((f) => f.severity === "critical");
    expect(criticals.length).toBeGreaterThanOrEqual(1);
    expect(criticals[0].description).toContain("not found");
  });

  test("Consistent timestamps score high", () => {
    writeValidEvidence(TEST_EVIDENCE, 6);
    const input = makeMinimalInput({
      raidResults: [makeRaidResult("raid-1")],
      markResults: [makeMarkResult()],
    });
    const result = quartermaster.checkTimestampConsistency(input);

    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  test("Out-of-order timestamps generate warning", () => {
    // Write evidence with out-of-order timestamps
    const dir = TEST_DIR;
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    let previousHash: string | null = null;
    const lines: string[] = [];

    // Record 1: timestamp T+1000
    const record1 = {
      sequence: 1,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      operation: "raid_initiated",
      data: { raidId: "raid-1" },
      previousHash,
    };
    const hash1 = makeHash(record1);
    lines.push(JSON.stringify({ ...record1, hash: hash1 }));
    previousHash = hash1;

    // Record 2: timestamp T+0 (before record 1 — out of order!)
    const record2 = {
      sequence: 2,
      timestamp: new Date(Date.now()).toISOString(),
      operation: "raid_executed",
      data: { raidId: "raid-1", success: false },
      previousHash,
    };
    const hash2 = makeHash(record2);
    lines.push(JSON.stringify({ ...record2, hash: hash2 }));

    writeFileSync(TEST_EVIDENCE, lines.join("\n") + "\n");

    const input = makeMinimalInput();
    const result = quartermaster.checkTimestampConsistency(input);

    const warnings = result.findings.filter((f) => f.severity === "warning");
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });

  test("RAID results correlated with PLUNDER results", () => {
    writeValidEvidence(TEST_EVIDENCE, 3);
    const input = makeMinimalInput({
      raidResults: [makeRaidResult("raid-0")],
    });
    const result = quartermaster.checkRaidPlunderCorrelation(input);

    // Raid-0 exists in both raidResults and evidence
    expect(result.score).toBeGreaterThanOrEqual(50);
  });

  test("Missing PLUNDER for existing RAID generates finding", () => {
    writeValidEvidence(TEST_EVIDENCE, 3);
    const input = makeMinimalInput({
      raidResults: [
        makeRaidResult("raid-0"),
        makeRaidResult("raid-missing"),  // Not in evidence
      ],
    });
    const result = quartermaster.checkRaidPlunderCorrelation(input);

    const findings = result.findings.filter(
      (f) => f.description.includes("raid-missing")
    );
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  test("Empty evidence paths scores 0", () => {
    const input = makeMinimalInput({ evidencePaths: [] });
    const result = quartermaster.checkEvidenceIntegrity(input);

    expect(result.score).toBe(0);
    const criticals = result.findings.filter((f) => f.severity === "critical");
    expect(criticals.length).toBeGreaterThanOrEqual(1);
  });

  test("Multiple valid evidence files all verified", () => {
    const path1 = `${TEST_DIR}/evidence1.jsonl`;
    const path2 = `${TEST_DIR}/evidence2.jsonl`;
    writeValidEvidence(path1, 3);
    writeValidEvidence(path2, 3);

    const input = makeMinimalInput({ evidencePaths: [path1, path2] });
    const result = quartermaster.checkEvidenceIntegrity(input);

    expect(result.score).toBe(100);
    expect(result.findings.filter((f) => f.severity === "critical")).toHaveLength(0);
  });

  test("Timestamp gap > 24h between RECON and RAID generates info finding", () => {
    // Write evidence with a 25-hour gap
    const dir = TEST_DIR;
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    let previousHash: string | null = null;
    const lines: string[] = [];
    const now = Date.now();

    // Record 1: RECON at T
    const record1 = {
      sequence: 1,
      timestamp: new Date(now - 25 * 60 * 60 * 1000).toISOString(),
      operation: "raid_initiated",
      data: { raidId: "raid-old" },
      previousHash,
    };
    const hash1 = makeHash(record1);
    lines.push(JSON.stringify({ ...record1, hash: hash1 }));
    previousHash = hash1;

    // Record 2: RAID at T+25h
    const record2 = {
      sequence: 2,
      timestamp: new Date(now).toISOString(),
      operation: "raid_executed",
      data: { raidId: "raid-old", success: false },
      previousHash,
    };
    const hash2 = makeHash(record2);
    lines.push(JSON.stringify({ ...record2, hash: hash2 }));

    writeFileSync(TEST_EVIDENCE, lines.join("\n") + "\n");

    const input = makeMinimalInput();
    const result = quartermaster.checkTimestampConsistency(input);

    const infoFindings = result.findings.filter((f) => f.severity === "info");
    expect(infoFindings.length).toBeGreaterThanOrEqual(1);
    expect(infoFindings.some((f) => f.description.includes("gap"))).toBe(true);
  });
});
