/**
 * GRC Model Arena — Scoring Engine Tests
 *
 * TDD: These tests are written FIRST. Implementation follows.
 * Covers all scoring methods, category runners, and leaderboard generation.
 */

import { describe, test, expect } from "bun:test";
import { scoreChallenge } from "./score";
import { scoreEvidenceParsing } from "./runners/evidence-parsing-runner";
import { scoreControlMapping } from "./runners/control-mapping-runner";
import { scoreCPOEGeneration } from "./runners/cpoe-generation-runner";
import { scoreDriftDetection } from "./runners/drift-detection-runner";
import { scoreGapAnalysis } from "./runners/gap-analysis-runner";
import { generateLeaderboard, formatLeaderboardMarkdown } from "../leaderboard";
import type {
  Challenge,
  ChallengeResult,
  ScoringConfig,
  BenchmarkRun,
  LeaderboardEntry,
} from "./types";

// =============================================================================
// HELPERS
// =============================================================================

function makeChallenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: "test-001",
    category: "evidence-parsing",
    difficulty: "easy",
    description: "Test challenge",
    input: "test/input.json",
    groundTruth: "test/expected.json",
    scoring: {
      method: "json-field-match",
      fields: ["summary.controlsPassed", "summary.controlsFailed"],
      partialCredit: true,
      maxScore: 100,
    },
    tags: ["test"],
    timeLimitMinutes: 5,
    ...overrides,
  };
}

function makeBenchmarkRun(overrides: Partial<BenchmarkRun> = {}): BenchmarkRun {
  return {
    runId: "run-001",
    date: "2026-02-13T00:00:00Z",
    agentModel: "claude-opus-4-6",
    results: [],
    overallScore: 0,
    categoryScores: {},
    ...overrides,
  };
}

// =============================================================================
// EVIDENCE PARSING RUNNER — json-field-match
// =============================================================================

describe("Evidence Parsing Runner (json-field-match)", () => {
  const config: ScoringConfig = {
    method: "json-field-match",
    fields: [
      "summary.controlsPassed",
      "summary.controlsFailed",
      "summary.overallScore",
    ],
    partialCredit: true,
    maxScore: 100,
  };

  test("should score 100 for exact field match on all fields", () => {
    const output = {
      summary: { controlsPassed: 20, controlsFailed: 2, overallScore: 91 },
    };
    const expected = {
      summary: { controlsPassed: 20, controlsFailed: 2, overallScore: 91 },
    };
    const result = scoreEvidenceParsing(output, expected, config);
    expect(result.score).toBe(100);
    expect(result.details.matchedFields).toBe(3);
    expect(result.details.totalFields).toBe(3);
  });

  test("should score partial credit for some matched fields", () => {
    const output = {
      summary: { controlsPassed: 20, controlsFailed: 5, overallScore: 91 },
    };
    const expected = {
      summary: { controlsPassed: 20, controlsFailed: 2, overallScore: 91 },
    };
    const result = scoreEvidenceParsing(output, expected, config);
    // 2 of 3 fields match
    expect(result.score).toBeCloseTo(66.67, 0);
    expect(result.details.matchedFields).toBe(2);
  });

  test("should score 0 when no fields match", () => {
    const output = {
      summary: { controlsPassed: 0, controlsFailed: 0, overallScore: 0 },
    };
    const expected = {
      summary: { controlsPassed: 20, controlsFailed: 2, overallScore: 91 },
    };
    const result = scoreEvidenceParsing(output, expected, config);
    expect(result.score).toBe(0);
    expect(result.details.matchedFields).toBe(0);
  });

  test("should score 0 when output is missing the field path entirely", () => {
    const output = { metadata: { title: "wrong structure" } };
    const expected = {
      summary: { controlsPassed: 20, controlsFailed: 2, overallScore: 91 },
    };
    const result = scoreEvidenceParsing(output, expected, config);
    expect(result.score).toBe(0);
  });

  test("should handle deeply nested field paths", () => {
    const deepConfig: ScoringConfig = {
      method: "json-field-match",
      fields: ["a.b.c.d"],
      partialCredit: true,
      maxScore: 100,
    };
    const output = { a: { b: { c: { d: 42 } } } };
    const expected = { a: { b: { c: { d: 42 } } } };
    const result = scoreEvidenceParsing(output, expected, deepConfig);
    expect(result.score).toBe(100);
  });

  test("should handle empty fields array", () => {
    const emptyConfig: ScoringConfig = {
      method: "json-field-match",
      fields: [],
      partialCredit: true,
      maxScore: 100,
    };
    const result = scoreEvidenceParsing({}, {}, emptyConfig);
    expect(result.score).toBe(0);
    expect(result.details.matchedFields).toBe(0);
    expect(result.details.totalFields).toBe(0);
  });

  test("should score 0 without partial credit when not all fields match", () => {
    const noPartialConfig: ScoringConfig = {
      method: "json-field-match",
      fields: ["summary.controlsPassed", "summary.controlsFailed"],
      partialCredit: false,
      maxScore: 100,
    };
    const output = { summary: { controlsPassed: 20, controlsFailed: 5 } };
    const expected = { summary: { controlsPassed: 20, controlsFailed: 2 } };
    const result = scoreEvidenceParsing(output, expected, noPartialConfig);
    // Without partial credit, must match ALL fields
    expect(result.score).toBe(0);
  });

  test("should score 100 without partial credit when all fields match", () => {
    const noPartialConfig: ScoringConfig = {
      method: "json-field-match",
      fields: ["summary.controlsPassed", "summary.controlsFailed"],
      partialCredit: false,
      maxScore: 100,
    };
    const output = { summary: { controlsPassed: 20, controlsFailed: 2 } };
    const expected = { summary: { controlsPassed: 20, controlsFailed: 2 } };
    const result = scoreEvidenceParsing(output, expected, noPartialConfig);
    expect(result.score).toBe(100);
  });
});

// =============================================================================
// CONTROL MAPPING RUNNER — precision-recall
// =============================================================================

describe("Control Mapping Runner (precision-recall)", () => {
  const config: ScoringConfig = {
    method: "precision-recall",
    threshold: 0.8,
    partialCredit: true,
    maxScore: 100,
  };

  test("should score 100 for perfect match", () => {
    const output = { controlIds: ["CC6.1", "CC6.2", "CC7.1"] };
    const expected = { controlIds: ["CC6.1", "CC6.2", "CC7.1"] };
    const result = scoreControlMapping(output, expected, config);
    expect(result.score).toBe(100);
    expect(result.details.precision).toBe(1.0);
    expect(result.details.recall).toBe(1.0);
    expect(result.details.f1).toBe(1.0);
  });

  test("should calculate correct precision and recall for partial overlap", () => {
    // Agent outputs 3, expected has 4. Agent got 2 right.
    const output = { controlIds: ["CC6.1", "CC6.2", "CC7.1"] };
    const expected = { controlIds: ["CC6.1", "CC6.2", "AC-2", "AC-3"] };
    const result = scoreControlMapping(output, expected, config);
    // precision = 2/3, recall = 2/4 = 0.5
    // F1 = 2 * (2/3 * 0.5) / (2/3 + 0.5) = 2 * 0.333 / 1.167 ≈ 0.571
    expect(result.details.precision).toBeCloseTo(0.667, 2);
    expect(result.details.recall).toBe(0.5);
    expect(result.details.f1).toBeCloseTo(0.571, 2);
    expect(result.score).toBeCloseTo(57.1, 0);
  });

  test("should score 0 for completely wrong output", () => {
    const output = { controlIds: ["WRONG-1", "WRONG-2"] };
    const expected = { controlIds: ["CC6.1", "CC6.2"] };
    const result = scoreControlMapping(output, expected, config);
    expect(result.score).toBe(0);
    expect(result.details.precision).toBe(0);
    expect(result.details.recall).toBe(0);
  });

  test("should handle empty agent output", () => {
    const output = { controlIds: [] };
    const expected = { controlIds: ["CC6.1", "CC6.2"] };
    const result = scoreControlMapping(output, expected, config);
    expect(result.score).toBe(0);
    expect(result.details.precision).toBe(0);
    expect(result.details.recall).toBe(0);
  });

  test("should handle empty expected set", () => {
    const output = { controlIds: ["CC6.1"] };
    const expected = { controlIds: [] };
    const result = scoreControlMapping(output, expected, config);
    // precision = 0 (nothing is correct), recall = 1 (nothing was missed)
    // But F1 with precision 0 = 0
    expect(result.score).toBe(0);
  });

  test("should handle both sets empty", () => {
    const output = { controlIds: [] };
    const expected = { controlIds: [] };
    const result = scoreControlMapping(output, expected, config);
    // Both empty = perfect match
    expect(result.score).toBe(100);
  });

  test("should handle duplicate IDs in output", () => {
    const output = { controlIds: ["CC6.1", "CC6.1", "CC6.2"] };
    const expected = { controlIds: ["CC6.1", "CC6.2"] };
    const result = scoreControlMapping(output, expected, config);
    // Duplicates should be deduplicated
    expect(result.details.precision).toBe(1.0);
    expect(result.details.recall).toBe(1.0);
    expect(result.score).toBe(100);
  });
});

// =============================================================================
// CPOE GENERATION RUNNER — cpoe-verify
// =============================================================================

describe("CPOE Generation Runner (cpoe-verify)", () => {
  const config: ScoringConfig = {
    method: "cpoe-verify",
    partialCredit: true,
    maxScore: 100,
  };

  // A minimal valid JWT structure (3 base64url segments)
  const validHeader = btoa(JSON.stringify({ alg: "EdDSA", typ: "vc+jwt" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  const makePayload = (subject: Record<string, unknown>) => {
    const payload = {
      iss: "did:web:grcorsair.com",
      vc: {
        credentialSubject: subject,
      },
    };
    return btoa(JSON.stringify(payload))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  };

  const fakeSig = "dGVzdC1zaWduYXR1cmU"; // base64url of "test-signature"

  test("should score 100 for valid JWT with correct schema and summary", () => {
    const subject = {
      type: "CorsairCPOE",
      summary: { controlsPassed: 20, controlsFailed: 2, overallScore: 91, controlsTested: 22 },
    };
    const expectedSubject = {
      type: "CorsairCPOE",
      summary: { controlsPassed: 20, controlsFailed: 2, overallScore: 91, controlsTested: 22 },
    };
    const jwt = `${validHeader}.${makePayload(subject)}.${fakeSig}`;
    const result = scoreCPOEGeneration({ jwt }, { credentialSubject: expectedSubject }, config);
    expect(result.score).toBe(100);
    expect(result.details.validJwt).toBe(true);
    expect(result.details.schemaMatch).toBe(true);
    expect(result.details.summaryAccurate).toBe(true);
  });

  test("should score 50 for valid JWT with wrong schema", () => {
    const subject = { type: "WrongType", summary: { controlsPassed: 0 } };
    const expectedSubject = {
      type: "CorsairCPOE",
      summary: { controlsPassed: 20, controlsFailed: 2, overallScore: 91, controlsTested: 22 },
    };
    const jwt = `${validHeader}.${makePayload(subject)}.${fakeSig}`;
    const result = scoreCPOEGeneration({ jwt }, { credentialSubject: expectedSubject }, config);
    expect(result.score).toBe(50);
    expect(result.details.validJwt).toBe(true);
    expect(result.details.schemaMatch).toBe(false);
  });

  test("should score 0 for invalid JWT format", () => {
    const result = scoreCPOEGeneration(
      { jwt: "not-a-jwt" },
      { credentialSubject: { type: "CorsairCPOE" } },
      config
    );
    expect(result.score).toBe(0);
    expect(result.details.validJwt).toBe(false);
  });

  test("should score 0 for missing jwt field", () => {
    const result = scoreCPOEGeneration(
      {},
      { credentialSubject: { type: "CorsairCPOE" } },
      config
    );
    expect(result.score).toBe(0);
  });

  test("should score 75 for valid JWT + correct schema but wrong summary", () => {
    const subject = {
      type: "CorsairCPOE",
      summary: { controlsPassed: 99, controlsFailed: 0, overallScore: 100, controlsTested: 99 },
    };
    const expectedSubject = {
      type: "CorsairCPOE",
      summary: { controlsPassed: 20, controlsFailed: 2, overallScore: 91, controlsTested: 22 },
    };
    const jwt = `${validHeader}.${makePayload(subject)}.${fakeSig}`;
    const result = scoreCPOEGeneration({ jwt }, { credentialSubject: expectedSubject }, config);
    expect(result.score).toBe(75);
    expect(result.details.validJwt).toBe(true);
    expect(result.details.schemaMatch).toBe(true);
    expect(result.details.summaryAccurate).toBe(false);
  });
});

// =============================================================================
// DRIFT DETECTION RUNNER — diff-match
// =============================================================================

describe("Drift Detection Runner (diff-match)", () => {
  const config: ScoringConfig = {
    method: "diff-match",
    partialCredit: true,
    maxScore: 100,
  };

  test("should score 100 for perfect regression match", () => {
    const output = {
      regressions: ["CC6.1", "CC7.2"],
    };
    const expected = {
      regressions: ["CC6.1", "CC7.2"],
    };
    const result = scoreDriftDetection(output, expected, config);
    expect(result.score).toBe(100);
    expect(result.details.recall).toBe(1.0);
    expect(result.details.precision).toBe(1.0);
  });

  test("should penalize missed regressions heavily (recall-weighted)", () => {
    const output = {
      regressions: ["CC6.1"],
    };
    const expected = {
      regressions: ["CC6.1", "CC7.2", "CC8.3"],
    };
    const result = scoreDriftDetection(output, expected, config);
    // recall = 1/3 ≈ 0.333, precision = 1/1 = 1.0
    // score = recall * 50 + precision * 50 = 16.67 + 50 = 66.67
    expect(result.details.recall).toBeCloseTo(0.333, 2);
    expect(result.details.precision).toBe(1.0);
    expect(result.score).toBeCloseTo(66.67, 0);
  });

  test("should handle false positives (extra regressions)", () => {
    const output = {
      regressions: ["CC6.1", "CC7.2", "FAKE-1", "FAKE-2"],
    };
    const expected = {
      regressions: ["CC6.1", "CC7.2"],
    };
    const result = scoreDriftDetection(output, expected, config);
    // recall = 2/2 = 1.0, precision = 2/4 = 0.5
    // score = 1.0 * 50 + 0.5 * 50 = 50 + 25 = 75
    expect(result.details.recall).toBe(1.0);
    expect(result.details.precision).toBe(0.5);
    expect(result.score).toBe(75);
  });

  test("should score 0 for completely wrong regressions", () => {
    const output = { regressions: ["WRONG-1"] };
    const expected = { regressions: ["CC6.1", "CC7.2"] };
    const result = scoreDriftDetection(output, expected, config);
    expect(result.details.recall).toBe(0);
    expect(result.score).toBe(0);
  });

  test("should handle empty agent output", () => {
    const output = { regressions: [] };
    const expected = { regressions: ["CC6.1"] };
    const result = scoreDriftDetection(output, expected, config);
    expect(result.score).toBe(0);
  });

  test("should handle both empty", () => {
    const output = { regressions: [] };
    const expected = { regressions: [] };
    const result = scoreDriftDetection(output, expected, config);
    expect(result.score).toBe(100);
  });
});

// =============================================================================
// GAP ANALYSIS RUNNER — precision-recall on missing controls
// =============================================================================

describe("Gap Analysis Runner (precision-recall on gaps)", () => {
  const config: ScoringConfig = {
    method: "precision-recall",
    threshold: 0.8,
    partialCredit: true,
    maxScore: 100,
  };

  test("should score 100 for perfect gap identification", () => {
    const output = { missingControls: ["AC-2", "AC-3", "IA-5"] };
    const expected = { missingControls: ["AC-2", "AC-3", "IA-5"] };
    const result = scoreGapAnalysis(output, expected, config);
    expect(result.score).toBe(100);
  });

  test("should calculate F1 for partial gap identification", () => {
    const output = { missingControls: ["AC-2", "AC-3"] };
    const expected = { missingControls: ["AC-2", "AC-3", "IA-5"] };
    const result = scoreGapAnalysis(output, expected, config);
    // precision = 2/2 = 1.0, recall = 2/3 ≈ 0.667
    // F1 = 2 * (1.0 * 0.667) / (1.0 + 0.667) ≈ 0.8
    expect(result.details.f1).toBeCloseTo(0.8, 1);
    expect(result.score).toBeCloseTo(80, 0);
  });

  test("should score 0 for completely wrong gaps", () => {
    const output = { missingControls: ["WRONG-1", "WRONG-2"] };
    const expected = { missingControls: ["AC-2", "AC-3"] };
    const result = scoreGapAnalysis(output, expected, config);
    expect(result.score).toBe(0);
  });

  test("should handle both empty (no gaps = correct)", () => {
    const output = { missingControls: [] };
    const expected = { missingControls: [] };
    const result = scoreGapAnalysis(output, expected, config);
    expect(result.score).toBe(100);
  });
});

// =============================================================================
// SCORE CHALLENGE DISPATCHER
// =============================================================================

describe("scoreChallenge (dispatcher)", () => {
  test("should dispatch json-field-match to evidence parsing", () => {
    const challenge = makeChallenge({
      scoring: {
        method: "json-field-match",
        fields: ["summary.controlsPassed"],
        partialCredit: true,
        maxScore: 100,
      },
    });
    const output = { summary: { controlsPassed: 20 } };
    const expected = { summary: { controlsPassed: 20 } };
    const result = scoreChallenge(challenge, output, expected);
    expect(result.challengeId).toBe("test-001");
    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
  });

  test("should dispatch precision-recall to control mapping", () => {
    const challenge = makeChallenge({
      id: "cm-001",
      category: "control-mapping",
      scoring: {
        method: "precision-recall",
        threshold: 0.8,
        partialCredit: true,
        maxScore: 100,
      },
    });
    const output = { controlIds: ["CC6.1", "CC6.2"] };
    const expected = { controlIds: ["CC6.1", "CC6.2"] };
    const result = scoreChallenge(challenge, output, expected);
    expect(result.challengeId).toBe("cm-001");
    expect(result.score).toBe(100);
  });

  test("should dispatch cpoe-verify to CPOE generation", () => {
    const challenge = makeChallenge({
      id: "cg-001",
      category: "cpoe-generation",
      scoring: {
        method: "cpoe-verify",
        partialCredit: true,
        maxScore: 100,
      },
    });
    const result = scoreChallenge(
      challenge,
      { jwt: "not-valid" },
      { credentialSubject: { type: "CorsairCPOE" } }
    );
    expect(result.challengeId).toBe("cg-001");
    expect(result.score).toBe(0);
    expect(result.passed).toBe(false);
  });

  test("should dispatch diff-match to drift detection", () => {
    const challenge = makeChallenge({
      id: "dd-001",
      category: "drift-detection",
      scoring: {
        method: "diff-match",
        partialCredit: true,
        maxScore: 100,
      },
    });
    const output = { regressions: ["CC6.1"] };
    const expected = { regressions: ["CC6.1"] };
    const result = scoreChallenge(challenge, output, expected);
    expect(result.challengeId).toBe("dd-001");
    expect(result.score).toBe(100);
  });

  test("should set passed=true when score >= 70", () => {
    const challenge = makeChallenge({
      scoring: {
        method: "json-field-match",
        fields: ["a", "b", "c"],
        partialCredit: true,
        maxScore: 100,
      },
    });
    // Match 3/3 fields = 100
    const result = scoreChallenge(challenge, { a: 1, b: 2, c: 3 }, { a: 1, b: 2, c: 3 });
    expect(result.passed).toBe(true);
  });

  test("should set passed=false when score < 70", () => {
    const challenge = makeChallenge({
      scoring: {
        method: "json-field-match",
        fields: ["a", "b", "c"],
        partialCredit: true,
        maxScore: 100,
      },
    });
    // Match 1/3 fields = 33.3
    const result = scoreChallenge(challenge, { a: 1, b: 99, c: 99 }, { a: 1, b: 2, c: 3 });
    expect(result.passed).toBe(false);
  });
});

// =============================================================================
// LEADERBOARD
// =============================================================================

describe("Leaderboard", () => {
  const run1: BenchmarkRun = makeBenchmarkRun({
    runId: "run-001",
    agentModel: "claude-opus-4-6",
    overallScore: 85,
    categoryScores: { "evidence-parsing": 90, "control-mapping": 80 },
    results: [
      {
        challengeId: "ep-001",
        agentModel: "claude-opus-4-6",
        score: 90,
        passed: true,
        timeSeconds: 10,
        attempt: 1,
        details: {},
      },
      {
        challengeId: "cm-001",
        agentModel: "claude-opus-4-6",
        score: 80,
        passed: true,
        timeSeconds: 15,
        attempt: 1,
        details: {},
      },
    ],
    date: "2026-02-13T00:00:00Z",
  });

  const run2: BenchmarkRun = makeBenchmarkRun({
    runId: "run-002",
    agentModel: "gpt-4o",
    overallScore: 72,
    categoryScores: { "evidence-parsing": 75, "control-mapping": 69 },
    results: [
      {
        challengeId: "ep-001",
        agentModel: "gpt-4o",
        score: 75,
        passed: true,
        timeSeconds: 20,
        attempt: 1,
        details: {},
      },
      {
        challengeId: "cm-001",
        agentModel: "gpt-4o",
        score: 69,
        passed: false,
        timeSeconds: 25,
        attempt: 1,
        details: {},
      },
    ],
    date: "2026-02-12T00:00:00Z",
  });

  test("should generate leaderboard ranked by overallScore descending", () => {
    const entries = generateLeaderboard([run1, run2]);
    expect(entries).toHaveLength(2);
    expect(entries[0].rank).toBe(1);
    expect(entries[0].agentModel).toBe("claude-opus-4-6");
    expect(entries[0].overallScore).toBe(85);
    expect(entries[1].rank).toBe(2);
    expect(entries[1].agentModel).toBe("gpt-4o");
    expect(entries[1].overallScore).toBe(72);
  });

  test("should count passed challenges correctly", () => {
    const entries = generateLeaderboard([run1, run2]);
    expect(entries[0].challengesPassed).toBe(2);
    expect(entries[0].challengesTotal).toBe(2);
    expect(entries[1].challengesPassed).toBe(1);
    expect(entries[1].challengesTotal).toBe(2);
  });

  test("should include category scores", () => {
    const entries = generateLeaderboard([run1]);
    expect(entries[0].categoryScores["evidence-parsing"]).toBe(90);
    expect(entries[0].categoryScores["control-mapping"]).toBe(80);
  });

  test("should use latest run date", () => {
    const entries = generateLeaderboard([run1, run2]);
    expect(entries[0].lastRunDate).toBe("2026-02-13T00:00:00Z");
    expect(entries[1].lastRunDate).toBe("2026-02-12T00:00:00Z");
  });

  test("should handle empty runs array", () => {
    const entries = generateLeaderboard([]);
    expect(entries).toHaveLength(0);
  });

  test("should handle single run", () => {
    const entries = generateLeaderboard([run1]);
    expect(entries).toHaveLength(1);
    expect(entries[0].rank).toBe(1);
  });

  test("should format leaderboard as markdown table", () => {
    const entries = generateLeaderboard([run1, run2]);
    const md = formatLeaderboardMarkdown(entries);
    expect(md).toContain("| Rank |");
    expect(md).toContain("claude-opus-4-6");
    expect(md).toContain("gpt-4o");
    expect(md).toContain("85.0");
    expect(md).toContain("72.0");
    expect(md).toContain("2/2");
    expect(md).toContain("1/2");
  });

  test("should return empty string for empty leaderboard", () => {
    const md = formatLeaderboardMarkdown([]);
    expect(md).toBe("");
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe("Edge cases", () => {
  test("should handle null/undefined agent output gracefully", () => {
    const challenge = makeChallenge({
      scoring: {
        method: "json-field-match",
        fields: ["summary.controlsPassed"],
        partialCredit: true,
        maxScore: 100,
      },
    });
    const result = scoreChallenge(challenge, null, { summary: { controlsPassed: 20 } });
    expect(result.score).toBe(0);
  });

  test("should handle string values in field match", () => {
    const config: ScoringConfig = {
      method: "json-field-match",
      fields: ["scope"],
      partialCredit: true,
      maxScore: 100,
    };
    const result = scoreEvidenceParsing(
      { scope: "SOC 2 Type II" },
      { scope: "SOC 2 Type II" },
      config
    );
    expect(result.score).toBe(100);
  });

  test("should handle boolean values in field match", () => {
    const config: ScoringConfig = {
      method: "json-field-match",
      fields: ["verified"],
      partialCredit: true,
      maxScore: 100,
    };
    const result = scoreEvidenceParsing({ verified: true }, { verified: true }, config);
    expect(result.score).toBe(100);
  });

  test("should fail boolean mismatch in field match", () => {
    const config: ScoringConfig = {
      method: "json-field-match",
      fields: ["verified"],
      partialCredit: true,
      maxScore: 100,
    };
    const result = scoreEvidenceParsing({ verified: false }, { verified: true }, config);
    expect(result.score).toBe(0);
  });
});
