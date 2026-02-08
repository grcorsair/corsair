import { describe, test, expect } from "bun:test";
import { calculateAssuranceLevel, calculateDocumentAssurance } from "../../src/ingestion/assurance-calculator";
import type { IngestedControl, DocumentMetadata } from "../../src/ingestion/types";

describe("Assurance Calculator", () => {
  const baseControl: IngestedControl = {
    id: "CC6.1",
    description: "Logical access security",
    status: "effective",
  };

  describe("calculateAssuranceLevel", () => {
    test("SOC 2 Type II with test evidence → L1 (Configured)", () => {
      const level = calculateAssuranceLevel(
        { ...baseControl, evidence: "Tested via inspection of MFA settings" },
        "soc2",
        { title: "SOC 2 Type II", issuer: "Acme", date: "2026-01-01", scope: "All", reportType: "SOC 2 Type II" }
      );
      expect(level).toBe(1);
    });

    test("SOC 2 Type I without evidence → L0 (Claimed)", () => {
      const level = calculateAssuranceLevel(
        { ...baseControl, evidence: undefined },
        "soc2",
        { title: "SOC 2 Type I", issuer: "Acme", date: "2026-01-01", scope: "All", reportType: "SOC 2 Type I" }
      );
      expect(level).toBe(0);
    });

    test("Prowler scan output → L1 (Configured)", () => {
      const level = calculateAssuranceLevel(
        { ...baseControl, evidence: "check-mfa-enabled: PASS" },
        "prowler",
        { title: "Prowler Scan", issuer: "Automated", date: "2026-01-01", scope: "AWS" }
      );
      expect(level).toBe(1);
    });

    test("Manual self-assessment → L0 (Claimed)", () => {
      const level = calculateAssuranceLevel(
        baseControl,
        "manual",
        { title: "Self Assessment", issuer: "Self", date: "2026-01-01", scope: "All" }
      );
      expect(level).toBe(0);
    });

    test("Pentest report with evidence → L2 (Demonstrated)", () => {
      const level = calculateAssuranceLevel(
        { ...baseControl, evidence: "Attempted MFA bypass — blocked successfully" },
        "pentest",
        { title: "Pentest Report", issuer: "SecureCo", date: "2026-01-01", scope: "Auth" }
      );
      expect(level).toBe(2);
    });

    test("Ineffective control stays at L0 regardless of source", () => {
      const level = calculateAssuranceLevel(
        { ...baseControl, status: "ineffective", evidence: "MFA disabled" },
        "soc2",
        { title: "SOC 2 Type II", issuer: "Acme", date: "2026-01-01", scope: "All", reportType: "SOC 2 Type II" }
      );
      expect(level).toBe(0);
    });

    test("Not-tested control → L0", () => {
      const level = calculateAssuranceLevel(
        { ...baseControl, status: "not-tested" },
        "soc2",
        { title: "SOC 2 Type II", issuer: "Acme", date: "2026-01-01", scope: "All", reportType: "SOC 2 Type II" }
      );
      expect(level).toBe(0);
    });

    test("SecurityHub finding → L1", () => {
      const level = calculateAssuranceLevel(
        { ...baseControl, evidence: "AWS Config rule: COMPLIANT" },
        "securityhub",
        { title: "SecurityHub", issuer: "AWS", date: "2026-01-01", scope: "Account" }
      );
      expect(level).toBe(1);
    });
  });

  describe("calculateDocumentAssurance", () => {
    test("Returns per-control assurance levels", () => {
      const controls: IngestedControl[] = [
        { ...baseControl, evidence: "Tested" },
        { ...baseControl, id: "CC6.2", status: "ineffective" },
        { ...baseControl, id: "CC7.1", status: "not-tested" },
      ];
      const metadata: DocumentMetadata = {
        title: "SOC 2 Type II",
        issuer: "Acme",
        date: "2026-01-01",
        scope: "All",
        reportType: "SOC 2 Type II",
      };
      const result = calculateDocumentAssurance(controls, "soc2", metadata);
      expect(result.length).toBe(3);
      expect(result[0].assuranceLevel).toBe(1);  // effective with evidence
      expect(result[1].assuranceLevel).toBe(0);  // ineffective
      expect(result[2].assuranceLevel).toBe(0);  // not-tested
    });
  });
});
