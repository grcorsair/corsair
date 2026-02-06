/**
 * Admiral Adversarial Scenarios
 *
 * 8 built-in scenarios that test whether the Admiral correctly detects
 * corruption, cherry-picking, bias, and other integrity issues.
 *
 * Each scenario provides a deliberately corrupted AdmiralInput and specifies
 * what the Admiral should flag.
 */

import { createHash } from "crypto";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { dirname } from "path";
import type { AdmiralInput } from "../admiral-types";
import type { AdmiralEvalScenario } from "./eval-types";
import type { MarkResult, RaidResult, ChartResult } from "../../types";

// =============================================================================
// HELPERS
// =============================================================================

function makeHash(record: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(record)).digest("hex");
}

function writeEvidenceFile(path: string, records: Array<Record<string, unknown>>): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  let previousHash: string | null = null;
  const lines: string[] = [];

  for (let i = 0; i < records.length; i++) {
    const record = {
      sequence: i + 1,
      timestamp: new Date(Date.now() + i * 1000).toISOString(),
      operation: records[i].operation || "raid_executed",
      data: records[i].data || { raidId: `raid-${i}` },
      previousHash,
    };
    const hash = makeHash(record);
    lines.push(JSON.stringify({ ...record, hash }));
    previousHash = hash;
  }

  writeFileSync(path, lines.join("\n") + "\n");
}

function writeBrokenEvidenceFile(path: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const record1 = {
    sequence: 1,
    timestamp: new Date().toISOString(),
    operation: "raid_initiated",
    data: { raidId: "raid-1" },
    previousHash: null,
  };
  const hash1 = makeHash(record1);

  const record2 = {
    sequence: 2,
    timestamp: new Date(Date.now() + 1000).toISOString(),
    operation: "raid_executed",
    data: { raidId: "raid-1", success: true },
    previousHash: "TAMPERED-HASH-VALUE",
  };
  const hash2 = makeHash(record2);

  const lines = [
    JSON.stringify({ ...record1, hash: hash1 }),
    JSON.stringify({ ...record2, hash: hash2 }),
  ];

  writeFileSync(path, lines.join("\n") + "\n");
}

function makeRaid(id: string, success: boolean, vector: string = "weak-password"): RaidResult {
  return {
    raidId: id,
    target: "test-target",
    vector: vector as any,
    success,
    controlsHeld: !success,
    findings: success ? ["Control bypassed"] : [],
    durationMs: 100,
    serialized: `RAID[${id}]`,
    timeline: [],
  };
}

function makeMark(drift: boolean, severity: string = "CRITICAL"): MarkResult {
  return {
    findings: drift
      ? [
          {
            field: "mfaConfiguration",
            expected: "ON",
            actual: "OFF",
            drift: true,
            severity: severity as any,
            timestamp: new Date().toISOString(),
          },
        ]
      : [],
    driftDetected: drift,
    checkedAt: new Date().toISOString(),
  };
}

function makeChart(): ChartResult {
  return {
    mitre: { technique: "T1556", name: "Modify Authentication Process", tactic: "Credential Access", description: "Test" },
    nist: { function: "PROTECT", category: "Access Control", controls: ["AC-2", "AC-7"] },
    soc2: { principle: "Security", criteria: ["CC6.1"], description: "Logical Access" },
  };
}

// =============================================================================
// SCENARIO DIRECTORY (temp dir for evidence files)
// =============================================================================

const SCENARIO_DIR = "/tmp/admiral-eval-scenarios";

// =============================================================================
// SCENARIOS
// =============================================================================

/**
 * Scenario 1: Broken hash chain — evidence has been tampered with.
 */
export function brokenHashChainScenario(): AdmiralEvalScenario {
  const evidencePath = `${SCENARIO_DIR}/broken-chain/evidence.jsonl`;
  writeBrokenEvidenceFile(evidencePath);

  return {
    id: "broken-hash-chain",
    name: "Broken Hash Chain",
    description: "Evidence file has a broken hash chain, indicating tampering",
    input: {
      evidencePaths: [evidencePath],
      markResults: [makeMark(true)],
      raidResults: [makeRaid("raid-1", false)],
      chartResults: [makeChart()],
      scope: { providers: ["aws-cognito"], resourceCount: 1 },
    },
    expectedFindingCategories: ["evidence_integrity"],
    expectedMinFindings: 1,
    expectedTrustTier: "self-assessed",
    expectedMaxScore: 75,
  };
}

/**
 * Scenario 2: Skipped MFA controls — cherry-picked easy tests.
 */
export function skippedMFAControlsScenario(): AdmiralEvalScenario {
  const evidencePath = `${SCENARIO_DIR}/skipped-mfa/evidence.jsonl`;
  writeEvidenceFile(evidencePath, [
    { operation: "raid_executed", data: { raidId: "raid-1", success: false } },
  ]);

  return {
    id: "skipped-mfa-controls",
    name: "Skipped MFA Controls",
    description: "Assessment only tested easy controls, skipping MFA entirely",
    input: {
      evidencePaths: [evidencePath],
      markResults: [], // No MARK results = no drift checks
      raidResults: [makeRaid("raid-1", false)],
      chartResults: [],
      scope: { providers: ["aws-cognito"], resourceCount: 1 },
    },
    expectedFindingCategories: ["methodology"],
    expectedMinFindings: 1,
    expectedTrustTier: "self-assessed",
    expectedMaxScore: 80,
  };
}

/**
 * Scenario 3: Severity bias — all findings are LOW severity.
 */
export function severityBiasScenario(): AdmiralEvalScenario {
  const evidencePath = `${SCENARIO_DIR}/severity-bias/evidence.jsonl`;
  writeEvidenceFile(evidencePath, [
    { operation: "raid_executed", data: { raidId: "raid-1", success: false } },
    { operation: "raid_executed", data: { raidId: "raid-2", success: false } },
    { operation: "raid_executed", data: { raidId: "raid-3", success: false } },
  ]);

  const lowMark: MarkResult = {
    findings: [
      { field: "a", expected: "x", actual: "y", drift: true, severity: "LOW" as any, timestamp: new Date().toISOString() },
      { field: "b", expected: "x", actual: "y", drift: true, severity: "LOW" as any, timestamp: new Date().toISOString() },
      { field: "c", expected: "x", actual: "y", drift: true, severity: "LOW" as any, timestamp: new Date().toISOString() },
    ],
    driftDetected: true,
    checkedAt: new Date().toISOString(),
  };

  return {
    id: "severity-bias",
    name: "Severity Bias",
    description: "All findings have LOW severity, suggesting testing easy/trivial things",
    input: {
      evidencePaths: [evidencePath],
      markResults: [lowMark],
      raidResults: [
        makeRaid("raid-1", false),
        makeRaid("raid-2", false),
        makeRaid("raid-3", false),
      ],
      chartResults: [makeChart()],
      scope: { providers: ["aws-cognito"], resourceCount: 1 },
    },
    expectedFindingCategories: ["bias_detection"],
    expectedMinFindings: 1,
    expectedTrustTier: "ai-verified",
    expectedMaxScore: 90,
  };
}

/**
 * Scenario 4: Timestamp manipulation — out-of-order timestamps.
 */
export function timestampManipulationScenario(): AdmiralEvalScenario {
  const evidencePath = `${SCENARIO_DIR}/timestamp-manip/evidence.jsonl`;
  const dir = dirname(evidencePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  // Write evidence with reversed timestamps
  let previousHash: string | null = null;
  const lines: string[] = [];
  const now = Date.now();

  for (let i = 0; i < 4; i++) {
    // Timestamps go BACKWARDS (suspicious)
    const record = {
      sequence: i + 1,
      timestamp: new Date(now - i * 60000).toISOString(),
      operation: "raid_executed",
      data: { raidId: `raid-${i}` },
      previousHash,
    };
    const hash = makeHash(record);
    lines.push(JSON.stringify({ ...record, hash }));
    previousHash = hash;
  }

  writeFileSync(evidencePath, lines.join("\n") + "\n");

  return {
    id: "timestamp-manipulation",
    name: "Timestamp Manipulation",
    description: "Evidence timestamps are in reverse order, suggesting manipulation",
    input: {
      evidencePaths: [evidencePath],
      markResults: [makeMark(true)],
      raidResults: [makeRaid("raid-0", false)],
      chartResults: [makeChart()],
      scope: { providers: ["aws-cognito"], resourceCount: 1 },
    },
    expectedFindingCategories: ["timestamp_consistency"],
    expectedMinFindings: 1,
    expectedTrustTier: "ai-verified",
    expectedMaxScore: 90,
  };
}

/**
 * Scenario 5: Phantom coverage — framework claims without evidence.
 */
export function phantomCoverageScenario(): AdmiralEvalScenario {
  const evidencePath = `${SCENARIO_DIR}/phantom-coverage/evidence.jsonl`;
  writeEvidenceFile(evidencePath, [
    { operation: "raid_executed", data: { raidId: "raid-1", success: false } },
  ]);

  return {
    id: "phantom-coverage",
    name: "Phantom Coverage",
    description: "Claims framework coverage but no MARK or CHART results to back it up",
    input: {
      evidencePaths: [evidencePath],
      markResults: [],
      raidResults: [makeRaid("raid-1", false)],
      chartResults: [], // No chart results = no framework mapping
      scope: { providers: ["aws-cognito", "aws-s3", "aws-iam"], resourceCount: 3 },
    },
    expectedFindingCategories: ["methodology"],
    expectedMinFindings: 1,
    expectedTrustTier: "self-assessed",
    expectedMaxScore: 80,
  };
}

/**
 * Scenario 6: Perfect score — all RAIDs blocked (too good to be true).
 */
export function perfectScoreScenario(): AdmiralEvalScenario {
  const evidencePath = `${SCENARIO_DIR}/perfect-score/evidence.jsonl`;
  writeEvidenceFile(evidencePath, [
    { operation: "raid_executed", data: { raidId: "raid-1", success: false } },
    { operation: "raid_executed", data: { raidId: "raid-2", success: false } },
    { operation: "raid_executed", data: { raidId: "raid-3", success: false } },
    { operation: "raid_executed", data: { raidId: "raid-4", success: false } },
  ]);

  return {
    id: "perfect-score",
    name: "Perfect Score",
    description: "All attacks blocked, all controls pass — suspiciously perfect",
    input: {
      evidencePaths: [evidencePath],
      markResults: [makeMark(false)],
      raidResults: [
        makeRaid("raid-1", false),
        makeRaid("raid-2", false),
        makeRaid("raid-3", false),
        makeRaid("raid-4", false),
      ],
      chartResults: [makeChart()],
      scope: { providers: ["aws-cognito"], resourceCount: 1 },
    },
    expectedFindingCategories: ["bias_detection"],
    expectedMinFindings: 1,
    expectedTrustTier: "ai-verified",
    expectedMaxScore: 95,
  };
}

/**
 * Scenario 7: Selective testing — RECON targets not covered by RAID.
 */
export function selectiveTestingScenario(): AdmiralEvalScenario {
  const evidencePath = `${SCENARIO_DIR}/selective-testing/evidence.jsonl`;
  writeEvidenceFile(evidencePath, [
    { operation: "raid_executed", data: { raidId: "raid-1", success: false } },
  ]);

  return {
    id: "selective-testing",
    name: "Selective Testing",
    description: "Multiple RAID results but no matching PLUNDER evidence for most",
    input: {
      evidencePaths: [evidencePath],
      markResults: [makeMark(true)],
      raidResults: [
        makeRaid("raid-1", false),
        makeRaid("raid-no-evidence-1", true),
        makeRaid("raid-no-evidence-2", true),
      ],
      chartResults: [makeChart()],
      scope: { providers: ["aws-cognito"], resourceCount: 1 },
    },
    expectedFindingCategories: ["raid_plunder_correlation"],
    expectedMinFindings: 1,
    expectedTrustTier: "ai-verified",
    expectedMaxScore: 90,
  };
}

/**
 * Scenario 8: Trivial ISC — superficially satisfiable criteria.
 */
export function trivialISCScenario(): AdmiralEvalScenario {
  const evidencePath = `${SCENARIO_DIR}/trivial-isc/evidence.jsonl`;
  writeEvidenceFile(evidencePath, [
    { operation: "raid_executed", data: { raidId: "raid-1", success: false } },
  ]);

  return {
    id: "trivial-isc",
    name: "Trivial ISC",
    description: "ISC criteria are trivially satisfiable, assessment lacks depth",
    input: {
      evidencePaths: [evidencePath],
      markResults: [],
      raidResults: [makeRaid("raid-1", false)],
      chartResults: [],
      iscCriteria: [
        { id: "ISC-1", text: "System exists", satisfaction: "SATISFIED" as any, evidenceRefs: [], evaluatedAt: new Date().toISOString() },
        { id: "ISC-2", text: "Config present", satisfaction: "SATISFIED" as any, evidenceRefs: [], evaluatedAt: new Date().toISOString() },
      ],
      scope: { providers: ["aws-cognito"], resourceCount: 1 },
    },
    expectedFindingCategories: ["methodology"],
    expectedMinFindings: 1,
    expectedTrustTier: "self-assessed",
    expectedMaxScore: 80,
  };
}

/**
 * Get all 8 built-in adversarial scenarios.
 */
export function getAllScenarios(): AdmiralEvalScenario[] {
  return [
    brokenHashChainScenario(),
    skippedMFAControlsScenario(),
    severityBiasScenario(),
    timestampManipulationScenario(),
    phantomCoverageScenario(),
    perfectScoreScenario(),
    selectiveTestingScenario(),
    trivialISCScenario(),
  ];
}
