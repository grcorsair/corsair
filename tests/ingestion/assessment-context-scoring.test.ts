import { describe, test, expect } from "bun:test";
import {
  calculateAssuranceDimensions,
} from "../../src/ingestion/assurance-calculator";
import type { IngestedControl, DocumentMetadata, AssessmentContext } from "../../src/ingestion/types";

// =============================================================================
// ASSESSMENT CONTEXT INTEGRATION TESTS (Phase 4)
// =============================================================================

const baseControl: IngestedControl = {
  id: "CC6.1",
  description: "Logical access security",
  status: "effective",
  evidence: "Inspected MFA config",
};

const recentDate = new Date();
recentDate.setDate(recentDate.getDate() - 30);

const soc2Metadata: DocumentMetadata = {
  title: "SOC 2 Type II",
  issuer: "Acme",
  date: recentDate.toISOString().split("T")[0],
  scope: "All",
  auditor: "Deloitte LLP",
  reportType: "SOC 2 Type II",
};

describe("Assessment Context Integration", () => {
  describe("coverage penalty from gaps", () => {
    test("3 gaps reduces coverage score compared to 0 gaps", () => {
      const controls = [baseControl];
      const contextNoGaps: AssessmentContext = {};
      const contextWithGaps: AssessmentContext = {
        gaps: [
          "Physical security controls not assessed",
          "Disaster recovery not in scope",
          "Third-party vendor management excluded",
        ],
      };

      const dimsNoGaps = calculateAssuranceDimensions(controls, "soc2", soc2Metadata, undefined, contextNoGaps);
      const dimsWithGaps = calculateAssuranceDimensions(controls, "soc2", soc2Metadata, undefined, contextWithGaps);

      expect(dimsWithGaps.coverage).toBeLessThan(dimsNoGaps.coverage);
    });

    test("gap penalty is capped (doesn't go below 0)", () => {
      const controls = [baseControl];
      const contextManyGaps: AssessmentContext = {
        gaps: Array.from({ length: 10 }, (_, i) => `Gap ${i + 1}`),
      };

      const dims = calculateAssuranceDimensions(controls, "soc2", soc2Metadata, undefined, contextManyGaps);
      expect(dims.coverage).toBeGreaterThanOrEqual(0);
    });
  });

  describe("methodology enrichment from assessor notes", () => {
    test("assessor notes mentioning reperformance enriches methodology", () => {
      const controls = [baseControl];
      const contextNoNotes: AssessmentContext = {};
      const contextWithNotes: AssessmentContext = {
        assessorNotes: "The auditor reperformed key access provisioning procedures and examined sample populations across all quarterly reviews.",
      };

      const dimsNoNotes = calculateAssuranceDimensions(controls, "soc2", soc2Metadata, undefined, contextNoNotes);
      const dimsWithNotes = calculateAssuranceDimensions(controls, "soc2", soc2Metadata, undefined, contextWithNotes);

      expect(dimsWithNotes.methodology).toBeGreaterThan(dimsNoNotes.methodology);
    });
  });

  describe("capability bonus from tech stack", () => {
    test("multi-system tech stack increases capability", () => {
      // Use mixed controls so base capability is < 100
      const controls = [
        baseControl,
        { ...baseControl, id: "CC6.2", status: "ineffective" as const },
      ];
      const contextNoStack: AssessmentContext = {};
      const contextWithStack: AssessmentContext = {
        techStack: [
          { component: "IdP", technology: "Okta", scope: "All employees" },
          { component: "Cloud", technology: "AWS", scope: "Production" },
          { component: "Monitoring", technology: "Datadog", scope: "All systems" },
          { component: "SIEM", technology: "Splunk", scope: "Security logs" },
        ],
      };

      const dimsNoStack = calculateAssuranceDimensions(controls, "soc2", soc2Metadata, undefined, contextNoStack);
      const dimsWithStack = calculateAssuranceDimensions(controls, "soc2", soc2Metadata, undefined, contextWithStack);

      expect(dimsWithStack.capability).toBeGreaterThan(dimsNoStack.capability);
    });

    test("capability bonus is capped at +20", () => {
      const controls = [baseControl];
      const contextHugeStack: AssessmentContext = {
        techStack: Array.from({ length: 10 }, (_, i) => ({
          component: `System ${i}`,
          technology: `Tech ${i}`,
          scope: `Scope ${i}`,
        })),
      };

      const dimsNoStack = calculateAssuranceDimensions(controls, "soc2", soc2Metadata);
      const dimsWithStack = calculateAssuranceDimensions(controls, "soc2", soc2Metadata, undefined, contextHugeStack);

      // Bonus should be at most 20 points
      expect(dimsWithStack.capability - dimsNoStack.capability).toBeLessThanOrEqual(20);
    });
  });

  describe("dimensions stay within 0-100", () => {
    test("all dimensions remain in valid range with context", () => {
      const controls = [baseControl];
      const context: AssessmentContext = {
        techStack: [
          { component: "IdP", technology: "Okta", scope: "All" },
          { component: "Cloud", technology: "AWS", scope: "Prod" },
        ],
        gaps: ["Gap 1"],
        assessorNotes: "Reperformed key procedures including MFA enrollment",
      };

      const dims = calculateAssuranceDimensions(controls, "soc2", soc2Metadata, undefined, context);

      for (const key of Object.keys(dims)) {
        const val = dims[key as keyof typeof dims];
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(100);
      }
    });
  });
});
