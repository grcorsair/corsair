/**
 * Score Signals Tests — FLAGSHIP event generation from score changes
 *
 * TDD: These tests are written FIRST. They must FAIL before implementation.
 * Then implementation makes them green.
 */

import { describe, test, expect } from "bun:test";
import type { EvidenceQualityScore, ScoredDimension } from "../../src/scoring/types";
import type { FlagshipEvent } from "../../src/flagship/flagship-types";
import { FLAGSHIP_EVENTS } from "../../src/flagship/flagship-types";
import {
  compareScores,
  scoreToFlagshipEvent,
  scoreAndSignal,
  type ScoreChangeEvent,
  type ScoreSignalConfig,
} from "../../src/scoring/score-signals";

// =============================================================================
// HELPERS — Build test scores
// =============================================================================

function makeDimension(overrides: Partial<ScoredDimension> = {}): ScoredDimension {
  return {
    name: overrides.name ?? "sourceIndependence",
    score: overrides.score ?? 80,
    weight: overrides.weight ?? 0.20,
    weighted: overrides.weighted ?? 16,
    method: overrides.method ?? "deterministic",
    detail: overrides.detail ?? "Test dimension",
  };
}

function makeScore(overrides: Partial<EvidenceQualityScore> = {}): EvidenceQualityScore {
  const composite = overrides.composite ?? 85;
  return {
    composite,
    grade: overrides.grade ?? gradeFrom(composite),
    dimensions: overrides.dimensions ?? [
      makeDimension({ name: "sourceIndependence", score: 80, weight: 0.20, weighted: 16 }),
      makeDimension({ name: "recency", score: 90, weight: 0.15, weighted: 13.5 }),
      makeDimension({ name: "coverage", score: 100, weight: 0.15, weighted: 15 }),
      makeDimension({ name: "reproducibility", score: 90, weight: 0.15, weighted: 13.5 }),
      makeDimension({ name: "consistency", score: 70, weight: 0.10, weighted: 7 }),
      makeDimension({ name: "evidenceQuality", score: 80, weight: 0.15, weighted: 12 }),
      makeDimension({ name: "completeness", score: 80, weight: 0.10, weighted: 8 }),
    ],
    controlsScored: overrides.controlsScored ?? 10,
    scoredAt: overrides.scoredAt ?? new Date().toISOString(),
    engineVersion: overrides.engineVersion ?? "1.0.0",
  };
}

function gradeFrom(composite: number): "A" | "B" | "C" | "D" | "F" {
  if (composite >= 90) return "A";
  if (composite >= 80) return "B";
  if (composite >= 70) return "C";
  if (composite >= 60) return "D";
  return "F";
}

// =============================================================================
// 1. SCORE COMPARISON — compareScores()
// =============================================================================

describe("compareScores", () => {
  test("first score (no previous) returns delta equal to current composite", () => {
    const current = makeScore({ composite: 85, grade: "B" });
    const change = compareScores(current, null);

    expect(change.previous).toBeNull();
    expect(change.current.composite).toBe(85);
    expect(change.current.grade).toBe("B");
    expect(change.delta).toBe(85);
    expect(change.gradeChanged).toBe(true);
    expect(change.direction).toBe("improved");
  });

  test("improved score returns positive delta", () => {
    const previous = makeScore({ composite: 70, grade: "C" });
    const current = makeScore({ composite: 85, grade: "B" });
    const change = compareScores(current, previous);

    expect(change.previous).not.toBeNull();
    expect(change.previous!.composite).toBe(70);
    expect(change.current.composite).toBe(85);
    expect(change.delta).toBe(15);
    expect(change.direction).toBe("improved");
  });

  test("degraded score returns negative delta", () => {
    const previous = makeScore({ composite: 90, grade: "A" });
    const current = makeScore({ composite: 75, grade: "C" });
    const change = compareScores(current, previous);

    expect(change.delta).toBe(-15);
    expect(change.direction).toBe("degraded");
  });

  test("stable score (same composite) returns zero delta", () => {
    const previous = makeScore({ composite: 85, grade: "B" });
    const current = makeScore({ composite: 85, grade: "B" });
    const change = compareScores(current, previous);

    expect(change.delta).toBe(0);
    expect(change.direction).toBe("stable");
    expect(change.gradeChanged).toBe(false);
  });

  test("grade change is detected when composite crosses boundary", () => {
    const previous = makeScore({ composite: 89, grade: "B" });
    const current = makeScore({ composite: 90, grade: "A" });
    const change = compareScores(current, previous);

    expect(change.gradeChanged).toBe(true);
  });

  test("no grade change when composite stays within same band", () => {
    const previous = makeScore({ composite: 82, grade: "B" });
    const current = makeScore({ composite: 87, grade: "B" });
    const change = compareScores(current, previous);

    expect(change.gradeChanged).toBe(false);
  });

  test("dimension changes are tracked", () => {
    const previous = makeScore({
      composite: 80,
      grade: "B",
      dimensions: [
        makeDimension({ name: "sourceIndependence", score: 80 }),
        makeDimension({ name: "recency", score: 90 }),
        makeDimension({ name: "coverage", score: 100 }),
        makeDimension({ name: "reproducibility", score: 90 }),
        makeDimension({ name: "consistency", score: 70 }),
        makeDimension({ name: "evidenceQuality", score: 60 }),
        makeDimension({ name: "completeness", score: 80 }),
      ],
    });
    const current = makeScore({
      composite: 85,
      grade: "B",
      dimensions: [
        makeDimension({ name: "sourceIndependence", score: 80 }),
        makeDimension({ name: "recency", score: 90 }),
        makeDimension({ name: "coverage", score: 100 }),
        makeDimension({ name: "reproducibility", score: 90 }),
        makeDimension({ name: "consistency", score: 70 }),
        makeDimension({ name: "evidenceQuality", score: 85 }),
        makeDimension({ name: "completeness", score: 80 }),
      ],
    });
    const change = compareScores(current, previous);

    expect(change.dimensionChanges).toBeDefined();
    expect(change.dimensionChanges).toHaveLength(7);

    const eqChange = change.dimensionChanges!.find(d => d.name === "evidenceQuality");
    expect(eqChange).toBeDefined();
    expect(eqChange!.delta).toBe(25);
    expect(eqChange!.direction).toBe("improved");
  });

  test("dimension changes are null for first score (no previous)", () => {
    const current = makeScore({ composite: 85, grade: "B" });
    const change = compareScores(current, null);

    expect(change.dimensionChanges).toBeNull();
  });

  test("small positive delta with same grade returns improved direction", () => {
    const previous = makeScore({ composite: 80, grade: "B" });
    const current = makeScore({ composite: 82, grade: "B" });
    const change = compareScores(current, previous);

    expect(change.delta).toBe(2);
    expect(change.direction).toBe("improved");
    expect(change.gradeChanged).toBe(false);
  });
});

// =============================================================================
// 2. GRADE BOUNDARY TESTS
// =============================================================================

describe("Grade Boundary Detection", () => {
  test("B->A boundary (89->90) triggers grade change", () => {
    const previous = makeScore({ composite: 89, grade: "B" });
    const current = makeScore({ composite: 90, grade: "A" });
    const change = compareScores(current, previous);

    expect(change.gradeChanged).toBe(true);
    expect(change.direction).toBe("improved");
  });

  test("A->B boundary (90->89) triggers grade change", () => {
    const previous = makeScore({ composite: 90, grade: "A" });
    const current = makeScore({ composite: 89, grade: "B" });
    const change = compareScores(current, previous);

    expect(change.gradeChanged).toBe(true);
    expect(change.direction).toBe("degraded");
  });

  test("C->B boundary (79->80) triggers grade change", () => {
    const previous = makeScore({ composite: 79, grade: "C" });
    const current = makeScore({ composite: 80, grade: "B" });
    const change = compareScores(current, previous);

    expect(change.gradeChanged).toBe(true);
  });

  test("D->C boundary (69->70) triggers grade change", () => {
    const previous = makeScore({ composite: 69, grade: "D" });
    const current = makeScore({ composite: 70, grade: "C" });
    const change = compareScores(current, previous);

    expect(change.gradeChanged).toBe(true);
  });

  test("F->D boundary (59->60) triggers grade change", () => {
    const previous = makeScore({ composite: 59, grade: "F" });
    const current = makeScore({ composite: 60, grade: "D" });
    const change = compareScores(current, previous);

    expect(change.gradeChanged).toBe(true);
  });

  test("same grade within B band (82->87) does not trigger", () => {
    const previous = makeScore({ composite: 82, grade: "B" });
    const current = makeScore({ composite: 87, grade: "B" });
    const change = compareScores(current, previous);

    expect(change.gradeChanged).toBe(false);
  });
});

// =============================================================================
// 3. FLAGSHIP EVENT GENERATION — scoreToFlagshipEvent()
// =============================================================================

describe("scoreToFlagshipEvent", () => {
  test("returns null when change is below threshold", () => {
    const change: ScoreChangeEvent = {
      previous: { composite: 85, grade: "B" },
      current: { composite: 87, grade: "B" },
      delta: 2,
      gradeChanged: false,
      direction: "improved",
      dimensionChanges: [],
    };

    const event = scoreToFlagshipEvent(change, "marque-123");
    expect(event).toBeNull();
  });

  test("returns event when delta exceeds threshold", () => {
    const change: ScoreChangeEvent = {
      previous: { composite: 70, grade: "C" },
      current: { composite: 85, grade: "B" },
      delta: 15,
      gradeChanged: true,
      direction: "improved",
      dimensionChanges: [],
    };

    const event = scoreToFlagshipEvent(change, "marque-123");
    expect(event).not.toBeNull();
    expect(event!.type).toBe(FLAGSHIP_EVENTS.COLORS_CHANGED);
  });

  test("returns event on grade change even when delta is below threshold", () => {
    const change: ScoreChangeEvent = {
      previous: { composite: 89, grade: "B" },
      current: { composite: 90, grade: "A" },
      delta: 1,
      gradeChanged: true,
      direction: "improved",
      dimensionChanges: [],
    };

    const event = scoreToFlagshipEvent(change, "marque-123");
    expect(event).not.toBeNull();
  });

  test("uses custom threshold", () => {
    const change: ScoreChangeEvent = {
      previous: { composite: 80, grade: "B" },
      current: { composite: 83, grade: "B" },
      delta: 3,
      gradeChanged: false,
      direction: "improved",
      dimensionChanges: [],
    };

    // Default threshold (5) would suppress this
    const withDefault = scoreToFlagshipEvent(change, "marque-123");
    expect(withDefault).toBeNull();

    // Custom threshold (2) would emit
    const withCustom = scoreToFlagshipEvent(change, "marque-123", { threshold: 2 });
    expect(withCustom).not.toBeNull();
  });

  test("signalOnGradeChange=false suppresses grade-only signals", () => {
    const change: ScoreChangeEvent = {
      previous: { composite: 89, grade: "B" },
      current: { composite: 90, grade: "A" },
      delta: 1,
      gradeChanged: true,
      direction: "improved",
      dimensionChanges: [],
    };

    const event = scoreToFlagshipEvent(change, "marque-123", {
      signalOnGradeChange: false,
    });
    // delta=1 is below default threshold=5, and grade override is disabled
    expect(event).toBeNull();
  });

  test("event contains correct marqueId in subject", () => {
    const change: ScoreChangeEvent = {
      previous: { composite: 70, grade: "C" },
      current: { composite: 85, grade: "B" },
      delta: 15,
      gradeChanged: true,
      direction: "improved",
      dimensionChanges: [],
    };

    const event = scoreToFlagshipEvent(change, "marque-abc-456");
    expect(event).not.toBeNull();
    expect(event!.data.subject.format).toBe("complex");
    expect(event!.data.subject.corsair.marqueId).toBe("marque-abc-456");
  });

  test("event data includes previous and current levels", () => {
    const change: ScoreChangeEvent = {
      previous: { composite: 70, grade: "C" },
      current: { composite: 85, grade: "B" },
      delta: 15,
      gradeChanged: true,
      direction: "improved",
      dimensionChanges: [],
    };

    const event = scoreToFlagshipEvent(change, "marque-123");
    expect(event).not.toBeNull();

    const data = event!.data as Record<string, unknown>;
    expect(data.previous_level).toBe("C");
    expect(data.current_level).toBe("B");
    expect(data.change_direction).toBe("increase");
  });

  test("degradation maps to decrease change_direction", () => {
    const change: ScoreChangeEvent = {
      previous: { composite: 90, grade: "A" },
      current: { composite: 75, grade: "C" },
      delta: -15,
      gradeChanged: true,
      direction: "degraded",
      dimensionChanges: [],
    };

    const event = scoreToFlagshipEvent(change, "marque-123");
    expect(event).not.toBeNull();

    const data = event!.data as Record<string, unknown>;
    expect(data.change_direction).toBe("decrease");
  });

  test("first score (no previous) with high composite emits event", () => {
    const change: ScoreChangeEvent = {
      previous: null,
      current: { composite: 85, grade: "B" },
      delta: 85,
      gradeChanged: true,
      direction: "improved",
      dimensionChanges: null,
    };

    const event = scoreToFlagshipEvent(change, "marque-first");
    expect(event).not.toBeNull();
    expect(event!.type).toBe(FLAGSHIP_EVENTS.COLORS_CHANGED);
  });

  test("event_timestamp is a valid Unix timestamp", () => {
    const change: ScoreChangeEvent = {
      previous: { composite: 70, grade: "C" },
      current: { composite: 85, grade: "B" },
      delta: 15,
      gradeChanged: true,
      direction: "improved",
      dimensionChanges: [],
    };

    const event = scoreToFlagshipEvent(change, "marque-123");
    expect(event).not.toBeNull();
    expect(typeof event!.data.event_timestamp).toBe("number");
    expect(event!.data.event_timestamp).toBeGreaterThan(0);
  });

  test("stable score with zero delta returns null", () => {
    const change: ScoreChangeEvent = {
      previous: { composite: 85, grade: "B" },
      current: { composite: 85, grade: "B" },
      delta: 0,
      gradeChanged: false,
      direction: "stable",
      dimensionChanges: [],
    };

    const event = scoreToFlagshipEvent(change, "marque-123");
    expect(event).toBeNull();
  });

  test("negative delta exceeding threshold emits event", () => {
    const change: ScoreChangeEvent = {
      previous: { composite: 85, grade: "B" },
      current: { composite: 78, grade: "C" },
      delta: -7,
      gradeChanged: true,
      direction: "degraded",
      dimensionChanges: [],
    };

    const event = scoreToFlagshipEvent(change, "marque-123");
    expect(event).not.toBeNull();
  });
});

// =============================================================================
// 4. PIPELINE INTEGRATION — scoreAndSignal()
// =============================================================================

describe("scoreAndSignal", () => {
  // We need CanonicalControlEvidence for scoreAndSignal
  const { makeControl, makeControls } = (() => {
    function makeControl(overrides: Record<string, unknown> = {}) {
      return {
        controlId: (overrides.controlId as string) ?? "ctrl-1",
        title: "Test Control",
        description: "A test control",
        status: (overrides.status as string) ?? "pass",
        severity: "medium",
        source: {
          tool: "test-tool",
          version: "1.0",
          rawId: "raw-1",
          rawStatus: "PASS",
          timestamp: new Date().toISOString(),
          ...(overrides.source as Record<string, unknown> ?? {}),
        },
        frameworks: [],
        evidence: {
          type: "scan",
          summary: "Scan result",
          ...(overrides.evidence as Record<string, unknown> ?? {}),
        },
        assurance: {
          level: 1,
          provenance: "tool",
          ...(overrides.assurance as Record<string, unknown> ?? {}),
        },
      };
    }

    function makeControls(count: number, overrides: Record<string, unknown> = {}) {
      return Array.from({ length: count }, (_, i) =>
        makeControl({ controlId: `ctrl-${i + 1}`, ...overrides })
      );
    }

    return { makeControl, makeControls };
  })();

  test("returns score, event, and change", () => {
    const controls = makeControls(10);
    const result = scoreAndSignal(controls as never[], null);

    expect(result).toHaveProperty("score");
    expect(result).toHaveProperty("event");
    expect(result).toHaveProperty("change");
    expect(result.score.composite).toBeGreaterThan(0);
    expect(result.change.previous).toBeNull();
  });

  test("first scoring emits event (large delta from zero)", () => {
    const controls = makeControls(10);
    const result = scoreAndSignal(controls as never[], null);

    // First score has delta = composite (>5), so event should be emitted
    expect(result.event).not.toBeNull();
    expect(result.change.direction).toBe("improved");
  });

  test("stable re-scoring returns null event", () => {
    const controls = makeControls(10);
    // Score once to get a baseline
    const first = scoreAndSignal(controls as never[], null);

    // Score again with same controls — should be stable
    const second = scoreAndSignal(controls as never[], first.score);

    expect(second.change.delta).toBe(0);
    expect(second.change.direction).toBe("stable");
    expect(second.event).toBeNull();
  });

  test("passes config to event generation", () => {
    const controls = makeControls(10);
    const first = scoreAndSignal(controls as never[], null);

    // Tiny threshold should trigger on any change
    const second = scoreAndSignal(controls as never[], first.score, { threshold: 0 });

    // Even with delta=0, threshold=0 means abs(0) >= 0 is true, but stable should still be null
    // Actually delta=0 means no change, so no signal even with threshold=0
    expect(second.event).toBeNull();
  });

  test("degraded controls trigger event", () => {
    const goodControls = makeControls(10, {
      assurance: { level: 4, provenance: "auditor" },
      evidence: { type: "attestation", summary: "Auditor verified" },
    });
    const firstResult = scoreAndSignal(goodControls as never[], null);

    const badControls = makeControls(10, {
      assurance: { level: 0, provenance: "self" },
      evidence: { type: "document", summary: "Policy doc" },
    });
    const secondResult = scoreAndSignal(badControls as never[], firstResult.score);

    expect(secondResult.change.direction).toBe("degraded");
    expect(secondResult.change.delta).toBeLessThan(0);
    expect(secondResult.event).not.toBeNull();
  });
});

// =============================================================================
// 5. DIMENSION CHANGE TRACKING
// =============================================================================

describe("Dimension Change Tracking", () => {
  test("identifies which dimensions improved", () => {
    const previous = makeScore({
      composite: 75,
      grade: "C",
      dimensions: [
        makeDimension({ name: "sourceIndependence", score: 30 }),
        makeDimension({ name: "recency", score: 90 }),
        makeDimension({ name: "coverage", score: 100 }),
        makeDimension({ name: "reproducibility", score: 90 }),
        makeDimension({ name: "consistency", score: 70 }),
        makeDimension({ name: "evidenceQuality", score: 40 }),
        makeDimension({ name: "completeness", score: 80 }),
      ],
    });
    const current = makeScore({
      composite: 85,
      grade: "B",
      dimensions: [
        makeDimension({ name: "sourceIndependence", score: 80 }),
        makeDimension({ name: "recency", score: 90 }),
        makeDimension({ name: "coverage", score: 100 }),
        makeDimension({ name: "reproducibility", score: 90 }),
        makeDimension({ name: "consistency", score: 70 }),
        makeDimension({ name: "evidenceQuality", score: 80 }),
        makeDimension({ name: "completeness", score: 80 }),
      ],
    });
    const change = compareScores(current, previous);

    const improved = change.dimensionChanges!.filter(d => d.direction === "improved");
    expect(improved.length).toBe(2); // sourceIndependence + evidenceQuality
  });

  test("identifies which dimensions degraded", () => {
    const previous = makeScore({
      composite: 85,
      grade: "B",
      dimensions: [
        makeDimension({ name: "sourceIndependence", score: 80 }),
        makeDimension({ name: "recency", score: 90 }),
        makeDimension({ name: "coverage", score: 100 }),
        makeDimension({ name: "reproducibility", score: 90 }),
        makeDimension({ name: "consistency", score: 70 }),
        makeDimension({ name: "evidenceQuality", score: 80 }),
        makeDimension({ name: "completeness", score: 80 }),
      ],
    });
    const current = makeScore({
      composite: 80,
      grade: "B",
      dimensions: [
        makeDimension({ name: "sourceIndependence", score: 80 }),
        makeDimension({ name: "recency", score: 50 }),
        makeDimension({ name: "coverage", score: 100 }),
        makeDimension({ name: "reproducibility", score: 90 }),
        makeDimension({ name: "consistency", score: 70 }),
        makeDimension({ name: "evidenceQuality", score: 80 }),
        makeDimension({ name: "completeness", score: 80 }),
      ],
    });
    const change = compareScores(current, previous);

    const degraded = change.dimensionChanges!.filter(d => d.direction === "degraded");
    expect(degraded.length).toBe(1); // recency
    expect(degraded[0].name).toBe("recency");
    expect(degraded[0].delta).toBe(-40);
  });

  test("stable dimensions have zero delta", () => {
    const dims = [
      makeDimension({ name: "sourceIndependence", score: 80 }),
      makeDimension({ name: "recency", score: 90 }),
      makeDimension({ name: "coverage", score: 100 }),
      makeDimension({ name: "reproducibility", score: 90 }),
      makeDimension({ name: "consistency", score: 70 }),
      makeDimension({ name: "evidenceQuality", score: 80 }),
      makeDimension({ name: "completeness", score: 80 }),
    ];
    const previous = makeScore({ composite: 85, grade: "B", dimensions: dims });
    const current = makeScore({ composite: 85, grade: "B", dimensions: dims });
    const change = compareScores(current, previous);

    const stable = change.dimensionChanges!.filter(d => d.direction === "stable");
    expect(stable.length).toBe(7);
    for (const d of stable) {
      expect(d.delta).toBe(0);
    }
  });
});

// =============================================================================
// 6. EDGE CASES
// =============================================================================

describe("Edge Cases", () => {
  test("exact threshold delta (5 points) emits event", () => {
    const change: ScoreChangeEvent = {
      previous: { composite: 80, grade: "B" },
      current: { composite: 85, grade: "B" },
      delta: 5,
      gradeChanged: false,
      direction: "improved",
      dimensionChanges: [],
    };

    const event = scoreToFlagshipEvent(change, "marque-123");
    expect(event).not.toBeNull();
  });

  test("delta of -5 (degradation) emits event", () => {
    const change: ScoreChangeEvent = {
      previous: { composite: 85, grade: "B" },
      current: { composite: 80, grade: "B" },
      delta: -5,
      gradeChanged: false,
      direction: "degraded",
      dimensionChanges: [],
    };

    const event = scoreToFlagshipEvent(change, "marque-123");
    expect(event).not.toBeNull();
  });

  test("delta of 4.99 below threshold does not emit", () => {
    const change: ScoreChangeEvent = {
      previous: { composite: 80, grade: "B" },
      current: { composite: 84.99, grade: "B" },
      delta: 4.99,
      gradeChanged: false,
      direction: "improved",
      dimensionChanges: [],
    };

    const event = scoreToFlagshipEvent(change, "marque-123");
    expect(event).toBeNull();
  });

  test("threshold of 0 still requires non-zero delta", () => {
    const change: ScoreChangeEvent = {
      previous: { composite: 85, grade: "B" },
      current: { composite: 85, grade: "B" },
      delta: 0,
      gradeChanged: false,
      direction: "stable",
      dimensionChanges: [],
    };

    const event = scoreToFlagshipEvent(change, "marque-123", { threshold: 0 });
    expect(event).toBeNull();
  });
});
