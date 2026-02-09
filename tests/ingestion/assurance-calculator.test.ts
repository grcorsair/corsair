import { describe, test, expect } from "bun:test";
import {
  calculateAssuranceLevel,
  calculateDocumentAssurance,
  calculateDocumentRollup,
  deriveProvenance,
  assessFreshness,
} from "../../src/ingestion/assurance-calculator";
import type { IngestedControl, DocumentMetadata, AssuranceLevel } from "../../src/ingestion/types";

describe("Assurance Calculator", () => {
  const baseControl: IngestedControl = {
    id: "CC6.1",
    description: "Logical access security",
    status: "effective",
  };

  const soc2Metadata: DocumentMetadata = {
    title: "SOC 2 Type II",
    issuer: "Acme",
    date: "2026-01-01",
    scope: "All",
    auditor: "Deloitte LLP",
    reportType: "SOC 2 Type II",
    rawTextHash: "sha256:abc123",
  };

  // ===========================================================================
  // EXISTING: Per-control assurance level
  // ===========================================================================

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

    test("Effective control with whitespace-only evidence → L0", () => {
      const level = calculateAssuranceLevel(
        { ...baseControl, evidence: "   " },
        "soc2",
        soc2Metadata,
      );
      expect(level).toBe(0);
    });

    test("Manual source with evidence still → L0 (manual ceiling)", () => {
      const level = calculateAssuranceLevel(
        { ...baseControl, evidence: "We verified MFA was enabled in settings" },
        "manual",
        { title: "Self Assessment", issuer: "Self", date: "2026-01-01", scope: "All" }
      );
      expect(level).toBe(0);
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

  // ===========================================================================
  // NEW: Document-level rollup → CPOEAssurance + CPOEProvenance
  // ===========================================================================

  describe("calculateDocumentRollup", () => {
    test("produces correct breakdown counting controls at each level", () => {
      const controls: (IngestedControl & { assuranceLevel: AssuranceLevel })[] = [
        { ...baseControl, evidence: "Tested MFA", assuranceLevel: 1 },
        { ...baseControl, id: "CC6.2", evidence: "Inspected config", assuranceLevel: 1 },
        { ...baseControl, id: "CC7.1", status: "ineffective", assuranceLevel: 0 },
      ];
      const result = calculateDocumentRollup(controls, "soc2", soc2Metadata);
      expect(result.assurance.breakdown).toEqual({ "0": 1, "1": 2 });
    });

    test("declared level = min of all in-scope controls (SSL model)", () => {
      const controls: (IngestedControl & { assuranceLevel: AssuranceLevel })[] = [
        { ...baseControl, evidence: "Tested", assuranceLevel: 1 },
        { ...baseControl, id: "CC6.2", evidence: "Tested", assuranceLevel: 1 },
        { ...baseControl, id: "CC7.1", status: "ineffective", assuranceLevel: 0 },
      ];
      const result = calculateDocumentRollup(controls, "soc2", soc2Metadata);
      expect(result.assurance.declared).toBe(0);
    });

    test("all L1 controls → declared L1", () => {
      const controls: (IngestedControl & { assuranceLevel: AssuranceLevel })[] = [
        { ...baseControl, evidence: "Tested", assuranceLevel: 1 },
        { ...baseControl, id: "CC6.2", evidence: "Tested", assuranceLevel: 1 },
        { ...baseControl, id: "CC7.1", evidence: "Checked", assuranceLevel: 1 },
      ];
      const result = calculateDocumentRollup(controls, "soc2", soc2Metadata);
      expect(result.assurance.declared).toBe(1);
    });

    test("excluded controls don't affect declared level", () => {
      const controls: (IngestedControl & { assuranceLevel: AssuranceLevel })[] = [
        { ...baseControl, evidence: "Tested", assuranceLevel: 1 },
        { ...baseControl, id: "CC6.2", evidence: "Tested", assuranceLevel: 1 },
        { ...baseControl, id: "CC7.3", status: "ineffective", assuranceLevel: 0 },
      ];
      const excluded = [{ controlId: "CC7.3", reason: "Physical security — not applicable" }];
      const result = calculateDocumentRollup(controls, "soc2", soc2Metadata, excluded);
      // CC7.3 excluded, so only L1 controls remain → declared L1
      expect(result.assurance.declared).toBe(1);
      expect(result.assurance.excluded).toEqual(excluded);
    });

    test("empty controls → declared L0", () => {
      const result = calculateDocumentRollup([], "soc2", soc2Metadata);
      expect(result.assurance.declared).toBe(0);
      expect(result.assurance.breakdown).toEqual({});
    });

    test("method derived from source type", () => {
      const controls: (IngestedControl & { assuranceLevel: AssuranceLevel })[] = [
        { ...baseControl, evidence: "Tested", assuranceLevel: 1 },
      ];
      const soc2Result = calculateDocumentRollup(controls, "soc2", soc2Metadata);
      expect(soc2Result.assurance.method).toBe("self-assessed");

      const prowlerResult = calculateDocumentRollup(controls, "prowler", soc2Metadata);
      expect(prowlerResult.assurance.method).toBe("automated-config-check");

      const pentestResult = calculateDocumentRollup(controls, "pentest", soc2Metadata);
      expect(pentestResult.assurance.method).toBe("ai-evidence-review");
    });

    test("verified = true when all in-scope controls >= declared", () => {
      const controls: (IngestedControl & { assuranceLevel: AssuranceLevel })[] = [
        { ...baseControl, evidence: "Tested", assuranceLevel: 1 },
        { ...baseControl, id: "CC6.2", evidence: "Tested", assuranceLevel: 1 },
      ];
      const result = calculateDocumentRollup(controls, "soc2", soc2Metadata);
      expect(result.assurance.verified).toBe(true);
    });

    test("provenance populated from metadata", () => {
      const controls: (IngestedControl & { assuranceLevel: AssuranceLevel })[] = [
        { ...baseControl, evidence: "Tested", assuranceLevel: 1 },
      ];
      const result = calculateDocumentRollup(controls, "soc2", soc2Metadata);
      expect(result.provenance.source).toBe("auditor");
      expect(result.provenance.sourceIdentity).toBe("Deloitte LLP");
      expect(result.provenance.sourceDocument).toBe("sha256:abc123");
      expect(result.provenance.sourceDate).toBe("2026-01-01");
    });
  });

  // ===========================================================================
  // NEW: Provenance derivation
  // ===========================================================================

  describe("deriveProvenance", () => {
    test("SOC 2 with auditor → source: auditor", () => {
      const result = deriveProvenance("soc2", soc2Metadata);
      expect(result.source).toBe("auditor");
      expect(result.sourceIdentity).toBe("Deloitte LLP");
    });

    test("ISO 27001 → source: auditor", () => {
      const result = deriveProvenance("iso27001", { ...soc2Metadata, auditor: "BSI" });
      expect(result.source).toBe("auditor");
      expect(result.sourceIdentity).toBe("BSI");
    });

    test("Prowler scan → source: tool", () => {
      const result = deriveProvenance("prowler", {
        title: "Prowler Scan",
        issuer: "Prowler v3.1",
        date: "2026-01-01",
        scope: "AWS",
      });
      expect(result.source).toBe("tool");
      expect(result.sourceIdentity).toBe("Prowler v3.1");
    });

    test("SecurityHub → source: tool", () => {
      const result = deriveProvenance("securityhub", {
        title: "SecurityHub",
        issuer: "AWS",
        date: "2026-01-01",
        scope: "Account",
      });
      expect(result.source).toBe("tool");
    });

    test("Pentest report → source: tool", () => {
      const result = deriveProvenance("pentest", {
        title: "Pentest Report",
        issuer: "SecureCo",
        date: "2026-01-01",
        scope: "Auth",
      });
      expect(result.source).toBe("tool");
    });

    test("Manual self-assessment → source: self", () => {
      const result = deriveProvenance("manual", {
        title: "Self Assessment",
        issuer: "Self",
        date: "2026-01-01",
        scope: "All",
      });
      expect(result.source).toBe("self");
    });

    test("includes sourceDocument hash when present", () => {
      const result = deriveProvenance("soc2", soc2Metadata);
      expect(result.sourceDocument).toBe("sha256:abc123");
    });

    test("omits sourceDocument when hash missing", () => {
      const result = deriveProvenance("soc2", { ...soc2Metadata, rawTextHash: undefined });
      expect(result.sourceDocument).toBeUndefined();
    });

    test("includes sourceDate", () => {
      const result = deriveProvenance("soc2", soc2Metadata);
      expect(result.sourceDate).toBe("2026-01-01");
    });

    test("prefers auditor field over issuer for sourceIdentity", () => {
      const result = deriveProvenance("soc2", {
        ...soc2Metadata,
        issuer: "Acme Corp",
        auditor: "EY",
      });
      expect(result.sourceIdentity).toBe("EY");
    });

    test("falls back to issuer when no auditor", () => {
      const result = deriveProvenance("prowler", {
        title: "Prowler Scan",
        issuer: "Prowler v3.1",
        date: "2026-01-01",
        scope: "AWS",
      });
      expect(result.sourceIdentity).toBe("Prowler v3.1");
    });
  });

  // ===========================================================================
  // NEW: Freshness assessment
  // ===========================================================================

  describe("assessFreshness", () => {
    test("assessment within 90 days → fresh", () => {
      const recent = new Date();
      recent.setDate(recent.getDate() - 30);
      const result = assessFreshness(recent.toISOString().split("T")[0]);
      expect(result.status).toBe("fresh");
      expect(result.ageDays).toBeLessThanOrEqual(31);
    });

    test("assessment 91-365 days ago → aging", () => {
      const aging = new Date();
      aging.setDate(aging.getDate() - 200);
      const result = assessFreshness(aging.toISOString().split("T")[0]);
      expect(result.status).toBe("aging");
      expect(result.ageDays).toBeGreaterThan(90);
      expect(result.ageDays).toBeLessThanOrEqual(365);
    });

    test("assessment > 365 days ago → stale", () => {
      const stale = new Date();
      stale.setDate(stale.getDate() - 400);
      const result = assessFreshness(stale.toISOString().split("T")[0]);
      expect(result.status).toBe("stale");
      expect(result.ageDays).toBeGreaterThan(365);
    });

    test("assessment at exactly 90 days → fresh", () => {
      const boundary = new Date();
      boundary.setDate(boundary.getDate() - 90);
      const result = assessFreshness(boundary.toISOString().split("T")[0]);
      expect(result.status).toBe("fresh");
    });

    test("assessment at exactly 365 days → aging", () => {
      const boundary = new Date();
      boundary.setDate(boundary.getDate() - 365);
      const result = assessFreshness(boundary.toISOString().split("T")[0]);
      expect(result.status).toBe("aging");
    });

    test("invalid date → stale with -1 ageDays", () => {
      const result = assessFreshness("not-a-date");
      expect(result.status).toBe("stale");
      expect(result.ageDays).toBe(-1);
    });
  });
});
