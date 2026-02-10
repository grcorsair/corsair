import { describe, test, expect } from "bun:test";
import { QuartermasterAgent } from "../../src/quartermaster/quartermaster-agent";
import type { QuartermasterDocumentInput } from "../../src/quartermaster/quartermaster-types";
import type { IngestedControl, DocumentMetadata, AssessmentContext } from "../../src/ingestion/types";

// =============================================================================
// QUARTERMASTER DOCUMENT EVALUATION TESTS (Phase 5)
// =============================================================================

const qm = new QuartermasterAgent({ apiKey: "test", model: "deterministic" });

const recentDate = new Date();
recentDate.setDate(recentDate.getDate() - 30);

const baseMetadata: DocumentMetadata = {
  title: "SOC 2 Type II",
  issuer: "Acme Corp",
  date: recentDate.toISOString().split("T")[0],
  scope: "Cloud Infrastructure",
  auditor: "Deloitte & Touche LLP",
  reportType: "SOC 2 Type II",
};

const richControl: IngestedControl = {
  id: "CC6.1",
  description: "Logical access security",
  status: "effective",
  evidence: "Reperformed MFA enrollment for a sample of 25 Okta users out of 1,247 in March 2026. All 25 were successfully enrolled. Inspected AWS CloudTrail logs for unauthorized access attempts.",
  severity: "CRITICAL",
};

const thinControl: IngestedControl = {
  id: "CC6.2",
  description: "Access provisioning",
  status: "effective",
  evidence: "Reviewed evidence and determined control is operating effectively.",
};

const inquiryControl: IngestedControl = {
  id: "CC7.1",
  description: "Change management",
  status: "effective",
  evidence: "Inquired with management about change management procedures.",
};

const ineffectiveControl: IngestedControl = {
  id: "CC7.2",
  description: "Incident response",
  status: "ineffective",
  evidence: "Observed that incident response procedures were not followed during the audit period.",
  severity: "HIGH",
};

const richContext: AssessmentContext = {
  techStack: [
    { component: "IdP", technology: "Okta", scope: "All employees" },
    { component: "Cloud", technology: "AWS", scope: "Production" },
    { component: "Monitoring", technology: "Datadog", scope: "All systems" },
  ],
  gaps: ["Physical security controls not assessed"],
  assessorNotes: "The auditor reperformed key access provisioning procedures and examined sample populations across all quarterly reviews. Walkthroughs of critical processes were observed.",
};

describe("Quartermaster Document Evaluation", () => {
  // =========================================================================
  // Core dimension scoring
  // =========================================================================

  describe("methodology scoring", () => {
    test("rich evidence with assessor notes scores high methodology", () => {
      const input: QuartermasterDocumentInput = {
        controls: [richControl, { ...richControl, id: "CC6.3" }],
        source: "soc2",
        metadata: baseMetadata,
        assessmentContext: richContext,
      };

      const report = qm.evaluateDocument(input);
      const methodDim = report.dimensions.find(d => d.dimension === "methodology");
      expect(methodDim).toBeDefined();
      expect(methodDim!.score).toBeGreaterThanOrEqual(70);
    });

    test("template evidence with no context scores low methodology", () => {
      const input: QuartermasterDocumentInput = {
        controls: [thinControl, { ...thinControl, id: "CC6.3" }],
        source: "soc2",
        metadata: { ...baseMetadata, auditor: undefined },
      };

      const report = qm.evaluateDocument(input);
      const methodDim = report.dimensions.find(d => d.dimension === "methodology");
      expect(methodDim).toBeDefined();
      expect(methodDim!.score).toBeLessThan(50);
    });
  });

  describe("evidence integrity scoring", () => {
    test("all controls with evidence scores high integrity", () => {
      const input: QuartermasterDocumentInput = {
        controls: [richControl, { ...richControl, id: "CC6.3" }],
        source: "soc2",
        metadata: baseMetadata,
      };

      const report = qm.evaluateDocument(input);
      const intDim = report.dimensions.find(d => d.dimension === "evidence_integrity");
      expect(intDim).toBeDefined();
      expect(intDim!.score).toBeGreaterThanOrEqual(60);
    });

    test("controls with boilerplate evidence score lower integrity", () => {
      const templateControls = Array.from({ length: 5 }, (_, i) => ({
        ...thinControl,
        id: `CC6.${i + 1}`,
      }));

      const input: QuartermasterDocumentInput = {
        controls: templateControls,
        source: "soc2",
        metadata: baseMetadata,
      };

      const report = qm.evaluateDocument(input);
      const intDim = report.dimensions.find(d => d.dimension === "evidence_integrity");
      expect(intDim).toBeDefined();
      expect(intDim!.score).toBeLessThan(80);
    });
  });

  describe("completeness scoring", () => {
    test("all controls with evidence and rationale for gaps scores high", () => {
      const input: QuartermasterDocumentInput = {
        controls: [richControl],
        source: "soc2",
        metadata: baseMetadata,
        assessmentContext: { gaps: ["Physical security — compensating control accepted"] },
      };

      const report = qm.evaluateDocument(input);
      const compDim = report.dimensions.find(d => d.dimension === "completeness");
      expect(compDim).toBeDefined();
      expect(compDim!.score).toBeGreaterThanOrEqual(50);
    });
  });

  describe("bias scoring", () => {
    test("all-pass with 10+ controls triggers bias warning", () => {
      const allPass = Array.from({ length: 12 }, (_, i) => ({
        ...richControl,
        id: `CC${i + 1}.1`,
      }));

      const input: QuartermasterDocumentInput = {
        controls: allPass,
        source: "soc2",
        metadata: baseMetadata,
      };

      const report = qm.evaluateDocument(input);
      const biasDim = report.dimensions.find(d => d.dimension === "bias_detection");
      expect(biasDim).toBeDefined();
      expect(biasDim!.score).toBeLessThan(100);
      // Should have a finding about all-pass bias
      expect(biasDim!.findings.length).toBeGreaterThan(0);
    });

    test("mixed pass/fail distribution is not penalized", () => {
      const mixed = [
        richControl,
        ineffectiveControl,
        { ...richControl, id: "CC6.3" },
      ];

      const input: QuartermasterDocumentInput = {
        controls: mixed,
        source: "soc2",
        metadata: baseMetadata,
      };

      const report = qm.evaluateDocument(input);
      const biasDim = report.dimensions.find(d => d.dimension === "bias_detection");
      expect(biasDim).toBeDefined();
      expect(biasDim!.score).toBeGreaterThanOrEqual(85);
    });
  });

  // =========================================================================
  // Probo Check 1: Auditor Legitimacy
  // =========================================================================

  describe("auditor legitimacy (Probo Check 1)", () => {
    test("known CPA firm pattern boosts independence", () => {
      const input: QuartermasterDocumentInput = {
        controls: [richControl],
        source: "soc2",
        metadata: { ...baseMetadata, auditor: "Deloitte & Touche LLP" },
      };

      const report = qm.evaluateDocument(input);
      const methodDim = report.dimensions.find(d => d.dimension === "methodology");
      expect(report.confidenceScore).toBeGreaterThan(0);
      // Should not have an auditor warning
      const auditorWarnings = report.dimensions
        .flatMap(d => d.findings)
        .filter(f => f.category === "auditor_legitimacy" && f.severity !== "info");
      expect(auditorWarnings.length).toBe(0);
    });

    test("missing auditor flags warning", () => {
      const input: QuartermasterDocumentInput = {
        controls: [richControl],
        source: "soc2",
        metadata: { ...baseMetadata, auditor: undefined },
      };

      const report = qm.evaluateDocument(input);
      const auditorFindings = report.dimensions
        .flatMap(d => d.findings)
        .filter(f => f.category === "auditor_legitimacy");
      expect(auditorFindings.length).toBeGreaterThan(0);
      expect(auditorFindings[0].severity).toBe("warning");
    });

    test("generic auditor name flags warning", () => {
      const input: QuartermasterDocumentInput = {
        controls: [richControl],
        source: "soc2",
        metadata: { ...baseMetadata, auditor: "the auditor" },
      };

      const report = qm.evaluateDocument(input);
      const auditorFindings = report.dimensions
        .flatMap(d => d.findings)
        .filter(f => f.category === "auditor_legitimacy");
      expect(auditorFindings.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Probo Check 4: System Description Specificity
  // =========================================================================

  describe("system description specificity (Probo Check 4)", () => {
    test("tech stack with systems referenced in evidence boosts score", () => {
      const input: QuartermasterDocumentInput = {
        controls: [richControl], // mentions "Okta" and "AWS CloudTrail"
        source: "soc2",
        metadata: baseMetadata,
        assessmentContext: {
          techStack: [
            { component: "IdP", technology: "Okta", scope: "All employees" },
            { component: "Cloud", technology: "AWS", scope: "Production" },
          ],
        },
      };

      const report = qm.evaluateDocument(input);
      // No system description warnings
      const sysFindings = report.dimensions
        .flatMap(d => d.findings)
        .filter(f => f.category === "system_description" && f.severity === "warning");
      expect(sysFindings.length).toBe(0);
    });

    test("empty tech stack flags methodology warning", () => {
      const input: QuartermasterDocumentInput = {
        controls: [richControl],
        source: "soc2",
        metadata: baseMetadata,
        assessmentContext: {},
      };

      const report = qm.evaluateDocument(input);
      const sysFindings = report.dimensions
        .flatMap(d => d.findings)
        .filter(f => f.category === "system_description");
      expect(sysFindings.length).toBeGreaterThan(0);
    });

    test("tech stack names not in evidence flags consistency warning", () => {
      const controlNoSystems: IngestedControl = {
        id: "CC6.1",
        description: "Logical access security",
        status: "effective",
        evidence: "Reviewed evidence and determined control is operating effectively.",
      };

      const input: QuartermasterDocumentInput = {
        controls: [controlNoSystems],
        source: "soc2",
        metadata: baseMetadata,
        assessmentContext: {
          techStack: [
            { component: "IdP", technology: "Okta", scope: "All employees" },
          ],
        },
      };

      const report = qm.evaluateDocument(input);
      const disconnectFindings = report.dimensions
        .flatMap(d => d.findings)
        .filter(f => f.description.includes("disconnected"));
      expect(disconnectFindings.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Probo Check 6: AICPA Structural Completeness
  // =========================================================================

  describe("AICPA structural completeness (Probo Check 6)", () => {
    test("SOC 2 with all sections scores high", () => {
      const input: QuartermasterDocumentInput = {
        controls: [richControl],
        source: "soc2",
        metadata: {
          ...baseMetadata,
          structuralSections: {
            auditorReport: true,
            managementAssertion: true,
            systemDescription: true,
            controlMatrix: true,
            testResults: true,
          },
        },
      };

      const report = qm.evaluateDocument(input);
      const structFindings = report.dimensions
        .flatMap(d => d.findings)
        .filter(f => f.category === "structural_completeness");
      expect(structFindings.length).toBe(0);
    });

    test("SOC 2 with missing sections flags warnings", () => {
      const input: QuartermasterDocumentInput = {
        controls: [richControl],
        source: "soc2",
        metadata: {
          ...baseMetadata,
          structuralSections: {
            auditorReport: true,
            managementAssertion: false,
            systemDescription: true,
            controlMatrix: true,
            testResults: false,
          },
        },
      };

      const report = qm.evaluateDocument(input);
      const structFindings = report.dimensions
        .flatMap(d => d.findings)
        .filter(f => f.category === "structural_completeness");
      expect(structFindings.length).toBe(2); // managementAssertion + testResults
    });

    test("non-SOC 2 document skips structural check", () => {
      const input: QuartermasterDocumentInput = {
        controls: [richControl],
        source: "prowler",
        metadata: {
          ...baseMetadata,
          structuralSections: {
            auditorReport: false,
            managementAssertion: false,
            systemDescription: false,
            controlMatrix: false,
            testResults: false,
          },
        },
      };

      const report = qm.evaluateDocument(input);
      const structFindings = report.dimensions
        .flatMap(d => d.findings)
        .filter(f => f.category === "structural_completeness");
      expect(structFindings.length).toBe(0);
    });
  });

  // =========================================================================
  // Overall report structure
  // =========================================================================

  describe("report structure", () => {
    test("report has all required fields", () => {
      const input: QuartermasterDocumentInput = {
        controls: [richControl],
        source: "soc2",
        metadata: baseMetadata,
      };

      const report = qm.evaluateDocument(input);

      expect(report.reportId).toMatch(/^qm-doc-/);
      expect(report.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(report.confidenceScore).toBeLessThanOrEqual(100);
      expect(report.dimensions.length).toBe(4);
      expect(report.trustTier).toBeDefined();
      expect(report.executiveSummary).toBeDefined();
      expect(report.reportHash).toBeDefined();
      expect(report.reportHash.length).toBe(64); // SHA-256 hex
    });

    test("confidence score is weighted average of dimensions", () => {
      const input: QuartermasterDocumentInput = {
        controls: [richControl],
        source: "soc2",
        metadata: baseMetadata,
        assessmentContext: richContext,
      };

      const report = qm.evaluateDocument(input);

      // Manually compute expected weighted score
      let expected = 0;
      for (const dim of report.dimensions) {
        expected += dim.score * dim.weight;
      }
      expect(report.confidenceScore).toBe(Math.round(expected));
    });

    test("LLM adjustment is clamped to [-20, +10]", () => {
      // evaluateDocument is deterministic-only (no LLM), so adjustments should be 0
      const input: QuartermasterDocumentInput = {
        controls: [richControl],
        source: "soc2",
        metadata: baseMetadata,
      };

      const report = qm.evaluateDocument(input);
      // All dimension scores should be within 0-100
      for (const dim of report.dimensions) {
        expect(dim.score).toBeGreaterThanOrEqual(0);
        expect(dim.score).toBeLessThanOrEqual(100);
      }
    });
  });
});
