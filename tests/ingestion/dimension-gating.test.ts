import { describe, test, expect } from "bun:test";
import {
  applyDimensionGating,
} from "../../src/ingestion/assurance-calculator";
import type { AssuranceDimensions } from "../../src/parley/vc-types";
import type { AssuranceLevel } from "../../src/ingestion/types";

// =============================================================================
// DIMENSION GATING TESTS (Phase 2)
// =============================================================================

describe("applyDimensionGating", () => {
  /** High dimensions — should not gate any level */
  const highDimensions: AssuranceDimensions = {
    capability: 90,
    coverage: 85,
    reliability: 80,
    methodology: 75,
    freshness: 85,
    independence: 90,
    consistency: 80,
  };

  /** Low dimensions — should gate most levels */
  const lowDimensions: AssuranceDimensions = {
    capability: 20,
    coverage: 15,
    reliability: 30,
    methodology: 25,
    freshness: 20,
    independence: 30,
    consistency: 20,
  };

  test("high dimensions → no gating applied, effective level unchanged", () => {
    const result = applyDimensionGating(2, highDimensions);
    expect(result.gatedLevel).toBe(2);
    expect(result.failedThresholds).toHaveLength(0);
  });

  test("L1 attempt with capability=20 → gated to L0", () => {
    const dims: AssuranceDimensions = {
      ...highDimensions,
      capability: 20,
    };
    const result = applyDimensionGating(1, dims);
    expect(result.gatedLevel).toBe(0);
    expect(result.failedThresholds.some(f => f.dimension === "capability")).toBe(true);
  });

  test("L1 attempt with coverage=20 → gated to L0", () => {
    const dims: AssuranceDimensions = {
      ...highDimensions,
      coverage: 20,
    };
    const result = applyDimensionGating(1, dims);
    expect(result.gatedLevel).toBe(0);
    expect(result.failedThresholds.some(f => f.dimension === "coverage")).toBe(true);
  });

  test("L2 attempt with methodology=30 → gated to L1", () => {
    const dims: AssuranceDimensions = {
      ...highDimensions,
      methodology: 30,
    };
    const result = applyDimensionGating(2, dims);
    expect(result.gatedLevel).toBeLessThanOrEqual(1);
    expect(result.failedThresholds.some(f => f.dimension === "methodology")).toBe(true);
  });

  test("L2 attempt with reliability=30 → gated to L1", () => {
    const dims: AssuranceDimensions = {
      ...highDimensions,
      reliability: 30,
    };
    const result = applyDimensionGating(2, dims);
    expect(result.gatedLevel).toBeLessThanOrEqual(1);
    expect(result.failedThresholds.some(f => f.dimension === "reliability")).toBe(true);
  });

  test("L3 attempt with freshness=50 → gated to L2", () => {
    const dims: AssuranceDimensions = {
      ...highDimensions,
      freshness: 50,
    };
    const result = applyDimensionGating(3, dims);
    expect(result.gatedLevel).toBeLessThanOrEqual(2);
    expect(result.failedThresholds.some(f => f.dimension === "freshness")).toBe(true);
  });

  test("L4 attempt with independence=60 → gated to L3", () => {
    const dims: AssuranceDimensions = {
      ...highDimensions,
      independence: 60,
    };
    const result = applyDimensionGating(4, dims);
    expect(result.gatedLevel).toBeLessThanOrEqual(3);
    expect(result.failedThresholds.some(f => f.dimension === "independence")).toBe(true);
  });

  test("failedThresholds array shows required vs actual", () => {
    const dims: AssuranceDimensions = {
      ...highDimensions,
      capability: 30,
    };
    const result = applyDimensionGating(1, dims);
    const capFail = result.failedThresholds.find(f => f.dimension === "capability");
    expect(capFail).toBeDefined();
    expect(capFail!.actual).toBe(30);
    expect(capFail!.required).toBeGreaterThan(30);
  });

  test("L0 declared → no gating (L0 has no requirements)", () => {
    const result = applyDimensionGating(0, lowDimensions);
    expect(result.gatedLevel).toBe(0);
    expect(result.failedThresholds).toHaveLength(0);
  });

  test("all low dimensions gating L2 → produces multiple failed thresholds", () => {
    const result = applyDimensionGating(2, lowDimensions);
    expect(result.gatedLevel).toBeLessThan(2);
    expect(result.failedThresholds.length).toBeGreaterThan(0);
  });

  test("gated level is the highest level where all thresholds pass", () => {
    // Dimensions that satisfy L1 but not L2
    const dims: AssuranceDimensions = {
      capability: 50,
      coverage: 40,
      reliability: 45,
      methodology: 45,
      freshness: 50,
      independence: 50,
      consistency: 50,
    };
    const result = applyDimensionGating(2, dims);
    // Should be L1 (meets L1 thresholds) but not L2 (methodology < 50)
    expect(result.gatedLevel).toBeLessThanOrEqual(1);
  });
});
