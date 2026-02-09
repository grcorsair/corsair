/**
 * CRQ Mapper Tests
 *
 * Tests CPOE → Risk Quantification mapping:
 * BetaPERT per level, FAIR-CAM mapping, provenance modifiers,
 * freshness decay, and dimension confidence.
 */

import { describe, test, expect } from "bun:test";
import {
  computeRiskQuantification,
  computeBetaPert,
  computeFairMapping,
  computeProvenanceModifier,
  computeFreshnessDecay,
  computeDimensionConfidence,
} from "../../src/parley/crq-mapper";
import type { CPOEAssurance, CPOEProvenance, AssuranceDimensions } from "../../src/parley/vc-types";

const baseSummary = {
  controlsTested: 24,
  controlsPassed: 22,
  controlsFailed: 2,
  overallScore: 91,
};

describe("CRQ Mapper", () => {
  // ===========================================================================
  // BetaPERT Mapping
  // ===========================================================================

  describe("computeBetaPert", () => {
    test("L0 → shape=2, very-wide", () => {
      const result = computeBetaPert(0);
      expect(result.shapeParameter).toBe(2);
      expect(result.confidenceWidth).toBe("very-wide");
    });

    test("L1 → shape=4, wide", () => {
      const result = computeBetaPert(1);
      expect(result.shapeParameter).toBe(4);
      expect(result.confidenceWidth).toBe("wide");
    });

    test("L2 → shape=6, moderate", () => {
      const result = computeBetaPert(2);
      expect(result.shapeParameter).toBe(6);
      expect(result.confidenceWidth).toBe("moderate");
    });

    test("L3 → shape=8, narrow", () => {
      const result = computeBetaPert(3);
      expect(result.shapeParameter).toBe(8);
      expect(result.confidenceWidth).toBe("narrow");
    });

    test("L4 → shape=10, very-narrow", () => {
      const result = computeBetaPert(4);
      expect(result.shapeParameter).toBe(10);
      expect(result.confidenceWidth).toBe("very-narrow");
    });
  });

  // ===========================================================================
  // FAIR-CAM Mapping
  // ===========================================================================

  describe("computeFairMapping", () => {
    test("L0 → very-low resistance strength", () => {
      const assurance: CPOEAssurance = { declared: 0, verified: false, method: "self-assessed", breakdown: {} };
      const result = computeFairMapping(assurance, baseSummary);
      expect(result.resistanceStrength).toBe("very-low");
    });

    test("L2 → moderate resistance strength", () => {
      const assurance: CPOEAssurance = { declared: 2, verified: true, method: "ai-evidence-review", breakdown: {} };
      const result = computeFairMapping(assurance, baseSummary);
      expect(result.resistanceStrength).toBe("moderate");
    });

    test("L4 → very-high resistance strength", () => {
      const assurance: CPOEAssurance = { declared: 4, verified: true, method: "third-party-attested", breakdown: {} };
      const result = computeFairMapping(assurance, baseSummary);
      expect(result.resistanceStrength).toBe("very-high");
    });

    test("overallScore 91 → controlEffectiveness 0.91", () => {
      const assurance: CPOEAssurance = { declared: 1, verified: true, method: "automated-config-check", breakdown: {} };
      const result = computeFairMapping(assurance, baseSummary);
      expect(result.controlEffectiveness).toBe(0.91);
    });

    test("overallScore 0 → controlEffectiveness 0", () => {
      const assurance: CPOEAssurance = { declared: 0, verified: false, method: "self-assessed", breakdown: {} };
      const result = computeFairMapping(assurance, { ...baseSummary, overallScore: 0 });
      expect(result.controlEffectiveness).toBe(0);
    });

    test("continuous-observation → variance-management function", () => {
      const assurance: CPOEAssurance = { declared: 3, verified: true, method: "continuous-observation", breakdown: {} };
      const result = computeFairMapping(assurance, baseSummary);
      expect(result.controlFunction).toBe("variance-management");
    });

    test("third-party-attested → decision-support function", () => {
      const assurance: CPOEAssurance = { declared: 4, verified: true, method: "third-party-attested", breakdown: {} };
      const result = computeFairMapping(assurance, baseSummary);
      expect(result.controlFunction).toBe("decision-support");
    });

    test("self-assessed → loss-event function", () => {
      const assurance: CPOEAssurance = { declared: 0, verified: false, method: "self-assessed", breakdown: {} };
      const result = computeFairMapping(assurance, baseSummary);
      expect(result.controlFunction).toBe("loss-event");
    });
  });

  // ===========================================================================
  // Provenance Modifier (Three Lines Model)
  // ===========================================================================

  describe("computeProvenanceModifier", () => {
    test("auditor → 1.25 (25% premium)", () => {
      expect(computeProvenanceModifier("auditor")).toBe(1.25);
    });

    test("tool → 1.0 (neutral)", () => {
      expect(computeProvenanceModifier("tool")).toBe(1.0);
    });

    test("self → 0.75 (25% discount)", () => {
      expect(computeProvenanceModifier("self")).toBe(0.75);
    });
  });

  // ===========================================================================
  // Freshness Decay
  // ===========================================================================

  describe("computeFreshnessDecay", () => {
    test("issued today → 1.0", () => {
      const today = new Date().toISOString();
      expect(computeFreshnessDecay(today)).toBe(1.0);
    });

    test("issued 182 days ago → ~0.50", () => {
      const d = new Date();
      d.setDate(d.getDate() - 182);
      const decay = computeFreshnessDecay(d.toISOString());
      expect(decay).toBeGreaterThanOrEqual(0.48);
      expect(decay).toBeLessThanOrEqual(0.52);
    });

    test("issued 365+ days ago → 0.0", () => {
      const d = new Date();
      d.setDate(d.getDate() - 400);
      expect(computeFreshnessDecay(d.toISOString())).toBe(0.0);
    });

    test("invalid date → 0", () => {
      expect(computeFreshnessDecay("not-a-date")).toBe(0);
    });
  });

  // ===========================================================================
  // Dimension Confidence (Geometric Mean)
  // ===========================================================================

  describe("computeDimensionConfidence", () => {
    test("no dimensions → 0.5 (neutral)", () => {
      expect(computeDimensionConfidence(undefined)).toBe(0.5);
    });

    test("all 100 → ~1.0", () => {
      const dims: AssuranceDimensions = {
        capability: 100, coverage: 100, reliability: 100,
        methodology: 100, freshness: 100, independence: 100, consistency: 100,
      };
      const conf = computeDimensionConfidence(dims);
      expect(conf).toBeGreaterThanOrEqual(0.95);
      expect(conf).toBeLessThanOrEqual(1.0);
    });

    test("all 0 → 0", () => {
      const dims: AssuranceDimensions = {
        capability: 0, coverage: 0, reliability: 0,
        methodology: 0, freshness: 0, independence: 0, consistency: 0,
      };
      expect(computeDimensionConfidence(dims)).toBe(0);
    });

    test("mixed dimensions → mid-range value", () => {
      const dims: AssuranceDimensions = {
        capability: 80, coverage: 60, reliability: 40,
        methodology: 50, freshness: 70, independence: 85, consistency: 55,
      };
      const conf = computeDimensionConfidence(dims);
      expect(conf).toBeGreaterThan(0.3);
      expect(conf).toBeLessThan(0.8);
    });

    test("one zero dimension drags down geometric mean", () => {
      const allHigh: AssuranceDimensions = {
        capability: 90, coverage: 90, reliability: 90,
        methodology: 90, freshness: 90, independence: 90, consistency: 90,
      };
      const oneZero: AssuranceDimensions = {
        ...allHigh,
        freshness: 0,
      };
      const highConf = computeDimensionConfidence(allHigh)!;
      const lowConf = computeDimensionConfidence(oneZero)!;
      expect(lowConf).toBeLessThan(highConf);
    });
  });

  // ===========================================================================
  // Full Integration
  // ===========================================================================

  describe("computeRiskQuantification", () => {
    test("produces complete risk quantification output", () => {
      const assurance: CPOEAssurance = {
        declared: 1,
        verified: true,
        method: "automated-config-check",
        breakdown: { "1": 22 },
      };
      const provenance: CPOEProvenance = { source: "auditor", sourceIdentity: "Deloitte" };
      const today = new Date().toISOString();

      const result = computeRiskQuantification(assurance, provenance, baseSummary, today);

      expect(result.betaPert.shapeParameter).toBe(4);
      expect(result.betaPert.confidenceWidth).toBe("wide");
      expect(result.fairMapping.resistanceStrength).toBe("low");
      expect(result.fairMapping.controlEffectiveness).toBe(0.91);
      expect(result.fairMapping.controlFunction).toBe("loss-event");
      expect(result.provenanceModifier).toBe(1.25);
      expect(result.freshnessDecay).toBe(1.0);
      expect(result.dimensionConfidence).toBe(0.5); // No dimensions passed
    });

    test("includes dimension confidence when dimensions provided", () => {
      const assurance: CPOEAssurance = {
        declared: 2,
        verified: true,
        method: "ai-evidence-review",
        breakdown: { "2": 20, "1": 4 },
      };
      const provenance: CPOEProvenance = { source: "tool" };
      const today = new Date().toISOString();
      const dims: AssuranceDimensions = {
        capability: 85, coverage: 70, reliability: 60,
        methodology: 75, freshness: 90, independence: 50, consistency: 65,
      };

      const result = computeRiskQuantification(assurance, provenance, baseSummary, today, dims);

      expect(result.dimensionConfidence).toBeGreaterThan(0);
      expect(result.dimensionConfidence).toBeLessThan(1);
      expect(result.dimensionConfidence).not.toBe(0.5); // Should differ from default
    });
  });
});
