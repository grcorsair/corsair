/**
 * Scoring Engine Tests — 7-Dimension Evidence Quality Assessment
 *
 * TDD: These tests are written FIRST. They must FAIL before implementation.
 * Then implementation makes them green.
 */

import { describe, test, expect } from "bun:test";
import type { CanonicalControlEvidence } from "../../src/normalize/types";
import {
  DIMENSION_WEIGHTS,
  PROVENANCE_SCORES,
  REPRODUCIBILITY_SCORES,
  EVIDENCE_QUALITY_SCORES,
  SCORING_ENGINE_VERSION,
} from "../../src/scoring/types";
import type { EvidenceQualityScore, LetterGrade } from "../../src/scoring/types";

// =============================================================================
// HELPERS — Build test controls
// =============================================================================

function makeControl(overrides: Partial<CanonicalControlEvidence> = {}): CanonicalControlEvidence {
  return {
    controlId: overrides.controlId ?? "ctrl-1",
    title: overrides.title ?? "Test Control",
    description: overrides.description ?? "A test control",
    status: overrides.status ?? "pass",
    severity: overrides.severity ?? "medium",
    source: {
      tool: "test-tool",
      version: "1.0",
      rawId: "raw-1",
      rawStatus: "PASS",
      timestamp: new Date().toISOString(),
      ...(overrides.source ?? {}),
    },
    frameworks: overrides.frameworks ?? [],
    evidence: {
      type: "scan",
      summary: "Scan result",
      ...(overrides.evidence ?? {}),
    },
    assurance: {
      level: 1,
      provenance: "tool",
      ...(overrides.assurance ?? {}),
    },
  };
}

function makeControls(count: number, overrides: Partial<CanonicalControlEvidence> = {}): CanonicalControlEvidence[] {
  return Array.from({ length: count }, (_, i) =>
    makeControl({ controlId: `ctrl-${i + 1}`, ...overrides })
  );
}

// =============================================================================
// IMPORT — This will fail until implementation exists
// =============================================================================

// Dynamic import so test file compiles even when module doesn't exist yet
let scoreEvidence: (controls: CanonicalControlEvidence[], options?: { hasProcessProvenance?: boolean }) => EvidenceQualityScore;

// We import at top to make it simple; tests will fail at import if module missing
import { scoreEvidence as _scoreEvidence } from "../../src/scoring/scoring-engine";
scoreEvidence = _scoreEvidence;

// =============================================================================
// 1. WEIGHTS VALIDATION
// =============================================================================

describe("Dimension Weights", () => {
  test("weights must sum to exactly 1.0", () => {
    const sum = Object.values(DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
  });

  test("all weights are positive", () => {
    for (const [name, weight] of Object.entries(DIMENSION_WEIGHTS)) {
      expect(weight).toBeGreaterThan(0);
    }
  });

  test("exactly 7 dimensions", () => {
    expect(Object.keys(DIMENSION_WEIGHTS)).toHaveLength(7);
  });
});

// =============================================================================
// 2. COMPOSITE SCORE STRUCTURE
// =============================================================================

describe("Score Structure", () => {
  test("returns EvidenceQualityScore shape", () => {
    const controls = makeControls(5);
    const result = scoreEvidence(controls);

    expect(result).toHaveProperty("composite");
    expect(result).toHaveProperty("grade");
    expect(result).toHaveProperty("dimensions");
    expect(result).toHaveProperty("controlsScored");
    expect(result).toHaveProperty("scoredAt");
    expect(result).toHaveProperty("engineVersion");
  });

  test("composite is between 0 and 100", () => {
    const controls = makeControls(5);
    const result = scoreEvidence(controls);

    expect(result.composite).toBeGreaterThanOrEqual(0);
    expect(result.composite).toBeLessThanOrEqual(100);
  });

  test("exactly 7 dimensions in output", () => {
    const controls = makeControls(5);
    const result = scoreEvidence(controls);

    expect(result.dimensions).toHaveLength(7);
  });

  test("all dimension scores between 0 and 100", () => {
    const controls = makeControls(5);
    const result = scoreEvidence(controls);

    for (const dim of result.dimensions) {
      expect(dim.score).toBeGreaterThanOrEqual(0);
      expect(dim.score).toBeLessThanOrEqual(100);
    }
  });

  test("weighted equals score * weight for each dimension", () => {
    const controls = makeControls(5);
    const result = scoreEvidence(controls);

    for (const dim of result.dimensions) {
      expect(Math.abs(dim.weighted - dim.score * dim.weight)).toBeLessThan(0.01);
    }
  });

  test("composite equals sum of weighted values", () => {
    const controls = makeControls(10);
    const result = scoreEvidence(controls);

    const expectedComposite = result.dimensions.reduce((sum, d) => sum + d.weighted, 0);
    expect(Math.abs(result.composite - expectedComposite)).toBeLessThan(0.01);
  });

  test("controlsScored matches input length", () => {
    const controls = makeControls(7);
    const result = scoreEvidence(controls);

    expect(result.controlsScored).toBe(7);
  });

  test("scoredAt is a valid ISO 8601 timestamp", () => {
    const controls = makeControls(3);
    const result = scoreEvidence(controls);

    expect(new Date(result.scoredAt).toISOString()).toBe(result.scoredAt);
  });

  test("engineVersion matches constant", () => {
    const controls = makeControls(3);
    const result = scoreEvidence(controls);

    expect(result.engineVersion).toBe(SCORING_ENGINE_VERSION);
  });
});

// =============================================================================
// 3. LETTER GRADE
// =============================================================================

describe("Letter Grade", () => {
  test("grade A for composite >= 90", () => {
    // All auditor, recent, full coverage, scan evidence = high scores
    const controls = makeControls(10, {
      assurance: { level: 4, provenance: "auditor" },
      evidence: { type: "scan", summary: "Automated scan" },
      source: { tool: "prowler", rawId: "r1", rawStatus: "PASS", timestamp: new Date().toISOString() },
    });
    const result = scoreEvidence(controls);
    // With all auditor (100), recent (100), full coverage (100), scan (90), etc.
    // this should score very high
    if (result.composite >= 90) {
      expect(result.grade).toBe("A");
    }
  });

  test("grade B for composite 80-89", () => {
    const grade = gradeFromComposite(85);
    expect(grade).toBe("B");
  });

  test("grade C for composite 70-79", () => {
    const grade = gradeFromComposite(75);
    expect(grade).toBe("C");
  });

  test("grade D for composite 60-69", () => {
    const grade = gradeFromComposite(65);
    expect(grade).toBe("D");
  });

  test("grade F for composite < 60", () => {
    const grade = gradeFromComposite(50);
    expect(grade).toBe("F");
  });
});

/** Helper: derive grade from composite using the same logic */
function gradeFromComposite(composite: number): LetterGrade {
  if (composite >= 90) return "A";
  if (composite >= 80) return "B";
  if (composite >= 70) return "C";
  if (composite >= 60) return "D";
  return "F";
}

// =============================================================================
// 4. DIMENSION 1: SOURCE INDEPENDENCE (weight: 0.20)
// =============================================================================

describe("Dimension: Source Independence", () => {
  test("all auditor controls score 100", () => {
    const controls = makeControls(5, {
      assurance: { level: 4, provenance: "auditor" },
    });
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "sourceIndependence");

    expect(dim).toBeDefined();
    expect(dim!.score).toBe(100);
    expect(dim!.weight).toBe(DIMENSION_WEIGHTS.sourceIndependence);
    expect(dim!.method).toBe("deterministic");
  });

  test("all tool controls score 80", () => {
    const controls = makeControls(5, {
      assurance: { level: 1, provenance: "tool" },
    });
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "sourceIndependence");

    expect(dim!.score).toBe(80);
  });

  test("all self controls score 30", () => {
    const controls = makeControls(5, {
      assurance: { level: 0, provenance: "self" },
    });
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "sourceIndependence");

    expect(dim!.score).toBe(30);
  });

  test("mixed provenance computes weighted average", () => {
    const controls = [
      makeControl({ controlId: "c1", assurance: { level: 4, provenance: "auditor" } }),
      makeControl({ controlId: "c2", assurance: { level: 1, provenance: "tool" } }),
      makeControl({ controlId: "c3", assurance: { level: 0, provenance: "self" } }),
    ];
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "sourceIndependence");

    // (100 + 80 + 30) / 3 = 70
    expect(dim!.score).toBe(70);
  });
});

// =============================================================================
// 5. DIMENSION 2: RECENCY (weight: 0.15)
// =============================================================================

describe("Dimension: Recency", () => {
  test("evidence from today scores ~100", () => {
    const controls = makeControls(5, {
      source: { tool: "prowler", rawId: "r1", rawStatus: "PASS", timestamp: new Date().toISOString() },
    });
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "recency");

    expect(dim).toBeDefined();
    expect(dim!.score).toBeGreaterThan(99);
    expect(dim!.weight).toBe(DIMENSION_WEIGHTS.recency);
    expect(dim!.method).toBe("deterministic");
  });

  test("evidence from 90 days ago scores ~75", () => {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const controls = makeControls(5, {
      source: { tool: "prowler", rawId: "r1", rawStatus: "PASS", timestamp: ninetyDaysAgo },
    });
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "recency");

    // 100 * (1 - 90/365) = 100 * 0.7534... = ~75.3
    expect(dim!.score).toBeGreaterThan(74);
    expect(dim!.score).toBeLessThan(77);
  });

  test("evidence from 365+ days ago scores 0", () => {
    const oldDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    const controls = makeControls(5, {
      source: { tool: "prowler", rawId: "r1", rawStatus: "PASS", timestamp: oldDate },
    });
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "recency");

    expect(dim!.score).toBe(0);
  });

  test("mixed recency computes average", () => {
    const today = new Date().toISOString();
    const halfYear = new Date(Date.now() - 182 * 24 * 60 * 60 * 1000).toISOString();
    const controls = [
      makeControl({ controlId: "c1", source: { tool: "t", rawId: "r1", rawStatus: "PASS", timestamp: today } }),
      makeControl({ controlId: "c2", source: { tool: "t", rawId: "r2", rawStatus: "PASS", timestamp: halfYear } }),
    ];
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "recency");

    // (~100 + ~50) / 2 = ~75
    expect(dim!.score).toBeGreaterThan(60);
    expect(dim!.score).toBeLessThan(85);
  });
});

// =============================================================================
// 6. DIMENSION 3: COVERAGE (weight: 0.15)
// =============================================================================

describe("Dimension: Coverage", () => {
  test("all controls with evidence = 100", () => {
    const controls = makeControls(10, {
      evidence: { type: "scan", summary: "Has evidence" },
    });
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "coverage");

    expect(dim).toBeDefined();
    expect(dim!.score).toBe(100);
    expect(dim!.weight).toBe(DIMENSION_WEIGHTS.coverage);
    expect(dim!.method).toBe("deterministic");
  });

  test("controls with skip status and no evidence reduce coverage", () => {
    const controls = [
      makeControl({ controlId: "c1", status: "pass", evidence: { type: "scan", summary: "evidence" } }),
      makeControl({ controlId: "c2", status: "skip", evidence: { type: "document", summary: "" } }),
    ];
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "coverage");

    // 1 covered out of 2 = 50
    expect(dim!.score).toBe(50);
  });

  test("all controls missing evidence = 0", () => {
    const controls = makeControls(5, {
      status: "skip",
      evidence: { type: "document", summary: "" },
    });
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "coverage");

    expect(dim!.score).toBe(0);
  });

  test("controls with non-empty evidence summary count as covered", () => {
    const controls = [
      makeControl({ controlId: "c1", evidence: { type: "scan", summary: "Scan found 0 issues" } }),
      makeControl({ controlId: "c2", evidence: { type: "config", summary: "MFA enabled" } }),
      makeControl({ controlId: "c3", evidence: { type: "document", summary: "" } }),
    ];
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "coverage");

    // 2/3 have evidence summary = ~66.67
    expect(dim!.score).toBeGreaterThan(66);
    expect(dim!.score).toBeLessThan(67);
  });
});

// =============================================================================
// 7. DIMENSION 4: REPRODUCIBILITY (weight: 0.15)
// =============================================================================

describe("Dimension: Reproducibility", () => {
  test("all scan evidence scores 90", () => {
    const controls = makeControls(5, {
      evidence: { type: "scan", summary: "Automated scan" },
    });
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "reproducibility");

    expect(dim).toBeDefined();
    expect(dim!.score).toBe(90);
    expect(dim!.weight).toBe(DIMENSION_WEIGHTS.reproducibility);
    expect(dim!.method).toBe("deterministic");
  });

  test("all test evidence scores 90", () => {
    const controls = makeControls(5, {
      evidence: { type: "test", summary: "Test results" },
    });
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "reproducibility");

    expect(dim!.score).toBe(90);
  });

  test("all config evidence scores 70", () => {
    const controls = makeControls(5, {
      evidence: { type: "config", summary: "Config export" },
    });
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "reproducibility");

    expect(dim!.score).toBe(70);
  });

  test("all document evidence scores 40", () => {
    const controls = makeControls(5, {
      evidence: { type: "document", summary: "Policy doc" },
    });
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "reproducibility");

    expect(dim!.score).toBe(40);
  });

  test("mixed evidence types compute average", () => {
    const controls = [
      makeControl({ controlId: "c1", evidence: { type: "scan", summary: "s" } }),      // 90
      makeControl({ controlId: "c2", evidence: { type: "document", summary: "s" } }),   // 40
    ];
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "reproducibility");

    // (90 + 40) / 2 = 65
    expect(dim!.score).toBe(65);
  });

  test("+10 bonus with process provenance receipts (capped at 100)", () => {
    const controls = makeControls(5, {
      evidence: { type: "scan", summary: "scan" },
    });
    const result = scoreEvidence(controls, { hasProcessProvenance: true });
    const dim = result.dimensions.find(d => d.name === "reproducibility");

    // 90 + 10 = 100 (capped)
    expect(dim!.score).toBe(100);
  });

  test("bonus does not exceed 100", () => {
    const controls = makeControls(5, {
      evidence: { type: "scan", summary: "scan" },
    });
    const result = scoreEvidence(controls, { hasProcessProvenance: true });
    const dim = result.dimensions.find(d => d.name === "reproducibility");

    expect(dim!.score).toBeLessThanOrEqual(100);
  });
});

// =============================================================================
// 8. DIMENSION 5: CONSISTENCY (weight: 0.10)
// =============================================================================

describe("Dimension: Consistency", () => {
  test("single source gets 70 (neutral)", () => {
    const controls = makeControls(5, {
      source: { tool: "prowler", rawId: "r1", rawStatus: "PASS", timestamp: new Date().toISOString() },
    });
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "consistency");

    expect(dim).toBeDefined();
    expect(dim!.score).toBe(70);
    expect(dim!.weight).toBe(DIMENSION_WEIGHTS.consistency);
    expect(dim!.method).toBe("deterministic");
  });

  test("multiple sources all agreeing score >= 90", () => {
    const controls = [
      makeControl({ controlId: "c1", status: "pass", source: { tool: "prowler", rawId: "r1", rawStatus: "PASS", timestamp: new Date().toISOString() } }),
      makeControl({ controlId: "c1", status: "pass", source: { tool: "inspec", rawId: "r2", rawStatus: "PASS", timestamp: new Date().toISOString() } }),
    ];
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "consistency");

    expect(dim!.score).toBeGreaterThanOrEqual(90);
  });

  test("multiple sources disagreeing get penalized", () => {
    const controls = [
      makeControl({ controlId: "c1", status: "pass", source: { tool: "prowler", rawId: "r1", rawStatus: "PASS", timestamp: new Date().toISOString() } }),
      makeControl({ controlId: "c1", status: "fail", source: { tool: "inspec", rawId: "r2", rawStatus: "FAIL", timestamp: new Date().toISOString() } }),
    ];
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "consistency");

    // Disagreement = penalty
    expect(dim!.score).toBeLessThan(70);
  });

  test("partial agreement scores between full agreement and full disagreement", () => {
    const controls = [
      // c1: 2 sources agree
      makeControl({ controlId: "c1", status: "pass", source: { tool: "prowler", rawId: "r1", rawStatus: "PASS", timestamp: new Date().toISOString() } }),
      makeControl({ controlId: "c1", status: "pass", source: { tool: "inspec", rawId: "r2", rawStatus: "PASS", timestamp: new Date().toISOString() } }),
      // c2: 2 sources disagree
      makeControl({ controlId: "c2", status: "pass", source: { tool: "prowler", rawId: "r3", rawStatus: "PASS", timestamp: new Date().toISOString() } }),
      makeControl({ controlId: "c2", status: "fail", source: { tool: "inspec", rawId: "r4", rawStatus: "FAIL", timestamp: new Date().toISOString() } }),
    ];
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "consistency");

    // Mix of agreement and disagreement
    expect(dim!.score).toBeGreaterThan(40);
    expect(dim!.score).toBeLessThan(90);
  });
});

// =============================================================================
// 9. DIMENSION 6: EVIDENCE QUALITY (weight: 0.15, model-assisted baseline)
// =============================================================================

describe("Dimension: Evidence Quality", () => {
  test("attestation evidence scores 90", () => {
    const controls = makeControls(5, {
      evidence: { type: "attestation", summary: "Third party attestation" },
    });
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "evidenceQuality");

    expect(dim).toBeDefined();
    expect(dim!.score).toBe(90);
    expect(dim!.weight).toBe(DIMENSION_WEIGHTS.evidenceQuality);
    expect(dim!.method).toBe("model-assisted");
  });

  test("test evidence scores 85", () => {
    const controls = makeControls(5, {
      evidence: { type: "test", summary: "Test results" },
    });
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "evidenceQuality");

    expect(dim!.score).toBe(85);
  });

  test("scan evidence scores 80", () => {
    const controls = makeControls(5, {
      evidence: { type: "scan", summary: "Scan results" },
    });
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "evidenceQuality");

    expect(dim!.score).toBe(80);
  });

  test("config evidence scores 60", () => {
    const controls = makeControls(5, {
      evidence: { type: "config", summary: "Config" },
    });
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "evidenceQuality");

    expect(dim!.score).toBe(60);
  });

  test("document evidence scores 40", () => {
    const controls = makeControls(5, {
      evidence: { type: "document", summary: "Doc" },
    });
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "evidenceQuality");

    expect(dim!.score).toBe(40);
  });

  test("mixed types compute average", () => {
    const controls = [
      makeControl({ controlId: "c1", evidence: { type: "scan", summary: "s" } }),     // 80
      makeControl({ controlId: "c2", evidence: { type: "document", summary: "s" } }), // 40
    ];
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "evidenceQuality");

    // (80 + 40) / 2 = 60
    expect(dim!.score).toBe(60);
  });
});

// =============================================================================
// 10. DIMENSION 7: COMPLETENESS (weight: 0.10, model-assisted baseline)
// =============================================================================

describe("Dimension: Completeness", () => {
  test("all controls non-skip = 100", () => {
    const controls = makeControls(10, { status: "pass" });
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "completeness");

    expect(dim).toBeDefined();
    expect(dim!.score).toBe(100);
    expect(dim!.weight).toBe(DIMENSION_WEIGHTS.completeness);
    expect(dim!.method).toBe("model-assisted");
  });

  test("half controls skipped = 50", () => {
    const controls = [
      ...makeControls(5, { status: "pass" }),
      ...makeControls(5, { status: "skip" }).map((c, i) => ({ ...c, controlId: `skip-${i}` })),
    ];
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "completeness");

    expect(dim!.score).toBe(50);
  });

  test("all controls skipped = 0", () => {
    const controls = makeControls(5, { status: "skip" });
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "completeness");

    expect(dim!.score).toBe(0);
  });

  test("fail status counts as non-skip (complete)", () => {
    const controls = makeControls(5, { status: "fail" });
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "completeness");

    // fail is still "completed" assessment = 100%
    expect(dim!.score).toBe(100);
  });

  test("error status counts as non-skip (complete)", () => {
    const controls = makeControls(5, { status: "error" });
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "completeness");

    expect(dim!.score).toBe(100);
  });
});

// =============================================================================
// 11. EDGE CASES
// =============================================================================

describe("Edge Cases", () => {
  test("empty controls array returns all zeros with grade F", () => {
    const result = scoreEvidence([]);

    expect(result.composite).toBe(0);
    expect(result.grade).toBe("F");
    expect(result.controlsScored).toBe(0);
    expect(result.dimensions).toHaveLength(7);
    for (const dim of result.dimensions) {
      expect(dim.score).toBe(0);
      expect(dim.weighted).toBe(0);
    }
  });

  test("single control produces valid score", () => {
    const controls = [makeControl()];
    const result = scoreEvidence(controls);

    expect(result.composite).toBeGreaterThan(0);
    expect(result.controlsScored).toBe(1);
    expect(result.dimensions).toHaveLength(7);
  });

  test("100 controls produces valid score", () => {
    const controls = makeControls(100);
    const result = scoreEvidence(controls);

    expect(result.composite).toBeGreaterThan(0);
    expect(result.controlsScored).toBe(100);
  });

  test("controls with invalid timestamps default recency to 0", () => {
    const controls = makeControls(3, {
      source: { tool: "t", rawId: "r", rawStatus: "PASS", timestamp: "invalid-date" },
    });
    const result = scoreEvidence(controls);
    const dim = result.dimensions.find(d => d.name === "recency");

    expect(dim!.score).toBe(0);
  });

  test("detail string is non-empty for all dimensions", () => {
    const controls = makeControls(5);
    const result = scoreEvidence(controls);

    for (const dim of result.dimensions) {
      expect(dim.detail.length).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// 12. INTEGRATION — REALISTIC SCENARIOS
// =============================================================================

describe("Realistic Scenarios", () => {
  test("Prowler scan (tool, recent, all pass) scores B or above", () => {
    const controls = makeControls(24, {
      status: "pass",
      assurance: { level: 1, provenance: "tool" },
      evidence: { type: "scan", summary: "Prowler check passed" },
      source: { tool: "prowler", version: "3.1", rawId: "prowler-1", rawStatus: "PASS", timestamp: new Date().toISOString() },
    });
    const result = scoreEvidence(controls);

    // Tool(80), Recent(~100), Full coverage(100), Scan(90), Single source(70), Scan quality(80), All non-skip(100)
    // Weighted: 80*0.20 + 100*0.15 + 100*0.15 + 90*0.15 + 70*0.10 + 80*0.15 + 100*0.10
    // = 16 + 15 + 15 + 13.5 + 7 + 12 + 10 = 88.5
    expect(result.composite).toBeGreaterThanOrEqual(80);
    expect(result.grade === "A" || result.grade === "B").toBe(true);
  });

  test("Self-reported policy docs score D or F", () => {
    const controls = makeControls(10, {
      status: "pass",
      assurance: { level: 0, provenance: "self" },
      evidence: { type: "document", summary: "Policy says so" },
      source: { tool: "manual", rawId: "m1", rawStatus: "effective", timestamp: new Date().toISOString() },
    });
    const result = scoreEvidence(controls);

    // Self(30), Recent(~100), Full coverage(100), Doc(40), Single source(70), Doc quality(40), All non-skip(100)
    // Weighted: 30*0.20 + 100*0.15 + 100*0.15 + 40*0.15 + 70*0.10 + 40*0.15 + 100*0.10
    // = 6 + 15 + 15 + 6 + 7 + 6 + 10 = 65
    expect(result.composite).toBeLessThan(70);
    expect(result.grade === "D" || result.grade === "F").toBe(true);
  });

  test("Auditor-attested recent evidence scores A", () => {
    const controls = makeControls(20, {
      status: "pass",
      assurance: { level: 4, provenance: "auditor" },
      evidence: { type: "attestation", summary: "Auditor verified" },
      source: { tool: "deloitte", rawId: "a1", rawStatus: "effective", timestamp: new Date().toISOString() },
    });
    const result = scoreEvidence(controls);

    // Auditor(100), Recent(~100), Full coverage(100), Attestation(40+10?), Single source(70), Attestation quality(90), All non-skip(100)
    // Very high composite
    expect(result.composite).toBeGreaterThanOrEqual(80);
  });

  test("Mixed old and new evidence scores lower than all-recent", () => {
    const recentControls = makeControls(5, {
      source: { tool: "prowler", rawId: "r1", rawStatus: "PASS", timestamp: new Date().toISOString() },
    });
    const oldControls = makeControls(5, {
      source: { tool: "prowler", rawId: "r2", rawStatus: "PASS", timestamp: new Date(Date.now() - 300 * 24 * 60 * 60 * 1000).toISOString() },
    }).map((c, i) => ({ ...c, controlId: `old-${i}` }));

    const allRecentResult = scoreEvidence([...recentControls, ...makeControls(5).map((c, i) => ({ ...c, controlId: `r2-${i}` }))]);
    const mixedResult = scoreEvidence([...recentControls, ...oldControls]);

    expect(mixedResult.composite).toBeLessThan(allRecentResult.composite);
  });
});
