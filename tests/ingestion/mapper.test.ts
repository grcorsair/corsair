import { describe, test, expect } from "bun:test";
import { mapToMarqueInput } from "../../src/ingestion/mapper";
import type { IngestedDocument } from "../../src/ingestion/types";

// =============================================================================
// FIXTURES
// =============================================================================

const minimalDocument: IngestedDocument = {
  source: "soc2",
  metadata: {
    title: "Acme Corp SOC 2 Type II",
    issuer: "Acme Corp",
    date: "2026-01-15",
    scope: "Cloud infrastructure security controls",
  },
  controls: [
    {
      id: "CC6.1-mfa",
      description: "Multi-factor authentication enforced for all users",
      status: "effective",
      severity: "CRITICAL",
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC6.1", controlName: "Logical Access Security" },
        { framework: "NIST-800-53", controlId: "IA-2", controlName: "Identification and Authentication" },
      ],
    },
    {
      id: "CC6.1-encryption",
      description: "Data at rest encrypted using AES-256",
      status: "effective",
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC6.1" },
        { framework: "NIST-800-53", controlId: "SC-28" },
      ],
    },
    {
      id: "CC7.2-logging",
      description: "Security event logging enabled with integrity validation",
      status: "ineffective",
      severity: "HIGH",
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC7.2" },
      ],
    },
  ],
};

const documentWithContext: IngestedDocument = {
  ...minimalDocument,
  controls: [
    {
      ...minimalDocument.controls[0],
      evidence: "Pen test confirmed MFA blocks unauthenticated access",
    },
  ],
  assessmentContext: {
    techStack: [
      { component: "Primary IdP", technology: "Okta", scope: "All employees via SSO" },
      { component: "Customer auth", technology: "AWS Cognito", scope: "45,000 customer accounts" },
    ],
    compensatingControls: [
      {
        description: "Okta provides MFA, not Cognito native MFA, for employee access",
        rationale: "Okta is the primary IdP. Cognito MFA is independent for customer tier.",
        acceptedBy: "Security team",
      },
    ],
    gaps: ["VPN access MFA not evidenced", "Service account MFA not applicable"],
    scopeCoverage: "85% of interactive user accounts",
  },
};

// =============================================================================
// TESTS
// =============================================================================

describe("Ingestion Mapper", () => {
  describe("mapToMarqueInput", () => {
    test("should produce valid MarqueGeneratorInput from minimal document", () => {
      const result = mapToMarqueInput(minimalDocument);

      expect(result.issuer).toBeDefined();
      expect(result.issuer.name).toBe("Acme Corp");
      expect(result.issuer.organization).toBe("Acme Corp");
      expect(result.providers).toContain("soc2-document");
      expect(result.markResults).toHaveLength(1);
      expect(result.raidResults).toHaveLength(0);
      expect(result.chartResults).toHaveLength(1);
      expect(result.evidencePaths).toHaveLength(0);
    });

    test("should map controls to DriftFindings in markResults", () => {
      const result = mapToMarqueInput(minimalDocument);
      const findings = result.markResults[0].findings;

      expect(findings).toHaveLength(3);

      // Effective controls → drift: false
      const mfaFinding = findings.find(f => f.id === "CC6.1-mfa");
      expect(mfaFinding).toBeDefined();
      expect(mfaFinding!.drift).toBe(false);
      expect(mfaFinding!.description).toBe("Multi-factor authentication enforced for all users");

      // Ineffective controls → drift: true
      const loggingFinding = findings.find(f => f.id === "CC7.2-logging");
      expect(loggingFinding).toBeDefined();
      expect(loggingFinding!.drift).toBe(true);
      expect(loggingFinding!.severity).toBe("HIGH");
    });

    test("should set driftDetected when any control is ineffective", () => {
      const result = mapToMarqueInput(minimalDocument);
      expect(result.markResults[0].driftDetected).toBe(true);
    });

    test("should not set driftDetected when all controls are effective", () => {
      const allEffective: IngestedDocument = {
        ...minimalDocument,
        controls: minimalDocument.controls.filter(c => c.status === "effective"),
      };
      const result = mapToMarqueInput(allEffective);
      expect(result.markResults[0].driftDetected).toBe(false);
    });

    test("should build chartResults from framework references", () => {
      const result = mapToMarqueInput(minimalDocument);
      const chart = result.chartResults[0];

      // Should have frameworks populated
      expect(chart.frameworks).toBeDefined();

      // SOC2 framework should have controls from multiple findings
      const soc2 = chart.frameworks!["SOC2"];
      expect(soc2).toBeDefined();
      expect(soc2.controls.length).toBeGreaterThanOrEqual(2);

      // NIST should also be present
      const nist = chart.frameworks!["NIST-800-53"];
      expect(nist).toBeDefined();
    });

    test("should map control status to framework control status", () => {
      const result = mapToMarqueInput(minimalDocument);
      const chart = result.chartResults[0];
      const soc2Controls = chart.frameworks!["SOC2"].controls;

      // CC6.1 should be passed (effective)
      const cc61 = soc2Controls.find(c => c.controlId === "CC6.1");
      expect(cc61).toBeDefined();
      expect(cc61!.status).toBe("passed");

      // CC7.2 should be failed (ineffective)
      const cc72 = soc2Controls.find(c => c.controlId === "CC7.2");
      expect(cc72).toBeDefined();
      expect(cc72!.status).toBe("failed");
    });

    test("should handle controls without framework references", () => {
      const noRefs: IngestedDocument = {
        ...minimalDocument,
        controls: [
          { id: "custom-1", description: "Custom control", status: "effective" },
        ],
      };
      const result = mapToMarqueInput(noRefs);

      // Should still produce valid output
      expect(result.markResults[0].findings).toHaveLength(1);
      // Chart may have empty frameworks
      expect(result.chartResults).toHaveLength(1);
    });

    test("should use issuer DID when provided", () => {
      const result = mapToMarqueInput(minimalDocument, {
        did: "did:web:acme.com",
      });
      expect(result.issuer.did).toBe("did:web:acme.com");
    });

    test("should handle document with assessment context", () => {
      const result = mapToMarqueInput(documentWithContext);

      // Should still produce valid base output
      expect(result.markResults).toHaveLength(1);
      expect(result.issuer.name).toBe("Acme Corp");

      // Assessment context doesn't change base MarqueGeneratorInput
      // (it's captured in the credential subject extension later)
    });

    test("should default severity to MEDIUM for controls without severity", () => {
      const noSeverity: IngestedDocument = {
        ...minimalDocument,
        controls: [
          { id: "test-1", description: "No severity", status: "ineffective" },
        ],
      };
      const result = mapToMarqueInput(noSeverity);
      const finding = result.markResults[0].findings[0];
      expect(finding.severity).toBe("MEDIUM");
    });

    test("should handle empty controls array", () => {
      const empty: IngestedDocument = {
        ...minimalDocument,
        controls: [],
      };
      const result = mapToMarqueInput(empty);
      expect(result.markResults[0].findings).toHaveLength(0);
      expect(result.markResults[0].driftDetected).toBe(false);
    });

    test("should pass through document reference for provenance building", () => {
      const result = mapToMarqueInput(minimalDocument);
      expect(result.document).toBeDefined();
      expect(result.document).toBe(minimalDocument);
      expect(result.document!.source).toBe("soc2");
      expect(result.document!.metadata.title).toBe("Acme Corp SOC 2 Type II");
    });
  });
});
