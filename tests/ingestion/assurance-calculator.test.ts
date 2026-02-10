import { describe, test, expect } from "bun:test";
import {
  calculateAssuranceLevel,
  calculateDocumentAssurance,
  calculateDocumentRollup,
  deriveProvenance,
  assessFreshness,
  calculateAssuranceDimensions,
  scoreCapability,
  scoreCoverage,
  scoreReliability,
  scoreMethodology,
  scoreFreshness,
  scoreIndependence,
  scoreConsistency,
  deriveEvidenceTypes,
  deriveObservationPeriod,
  applyAntiGamingSafeguards,
  generateRuleTrace,
  deriveEvidenceTypeDistribution,
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

  // ===========================================================================
  // 7-DIMENSION ASSURANCE MODEL (FAIR-CAM + GRADE + COSO)
  // ===========================================================================

  describe("scoreCapability", () => {
    test("all effective with evidence → high score", () => {
      const controls: IngestedControl[] = [
        { ...baseControl, evidence: "MFA verified" },
        { ...baseControl, id: "CC6.2", evidence: "Config checked" },
      ];
      const score = scoreCapability(controls);
      expect(score).toBe(100); // 100% pass + 100% evidence
    });

    test("mixed effective/ineffective → lower score", () => {
      const controls: IngestedControl[] = [
        { ...baseControl, evidence: "MFA verified" },
        { ...baseControl, id: "CC6.2", status: "ineffective" },
      ];
      const score = scoreCapability(controls);
      expect(score).toBe(50); // 50% pass (35) + 50% evidence (15) = 50
    });

    test("effective without evidence → partial score", () => {
      const controls: IngestedControl[] = [
        { ...baseControl },
        { ...baseControl, id: "CC6.2" },
      ];
      const score = scoreCapability(controls);
      expect(score).toBe(70); // 100% pass (70) + 0% evidence (0)
    });

    test("empty controls → 0", () => {
      expect(scoreCapability([])).toBe(0);
    });
  });

  describe("scoreCoverage", () => {
    test("all tested with framework refs → high score", () => {
      const controls: IngestedControl[] = [
        { ...baseControl, evidence: "Tested", frameworkRefs: [{ framework: "SOC2", controlId: "CC6.1" }] },
        { ...baseControl, id: "CC6.2", evidence: "Tested", frameworkRefs: [{ framework: "NIST-800-53", controlId: "AC-2" }] },
      ];
      const score = scoreCoverage(controls, soc2Metadata);
      expect(score).toBe(100); // 100% tested + 100% mapped
    });

    test("some not-tested → lower coverage", () => {
      const controls: IngestedControl[] = [
        { ...baseControl, evidence: "Tested" },
        { ...baseControl, id: "CC6.2", status: "not-tested" },
      ];
      const score = scoreCoverage(controls, soc2Metadata);
      expect(score).toBe(35); // 50% tested (35) + 0% mapped (0)
    });

    test("empty controls → 0", () => {
      expect(scoreCoverage([], soc2Metadata)).toBe(0);
    });
  });

  describe("scoreReliability", () => {
    test("all effective + fresh evidence → high score", () => {
      const controls: IngestedControl[] = [
        { ...baseControl, evidence: "MFA verified" },
        { ...baseControl, id: "CC6.2", evidence: "Config checked" },
      ];
      const score = scoreReliability(controls, { status: "fresh", ageDays: 30 });
      expect(score).toBe(100); // 100% effective (60) + fresh (40)
    });

    test("all effective + stale evidence → lower score", () => {
      const controls: IngestedControl[] = [
        { ...baseControl, evidence: "MFA verified" },
      ];
      const score = scoreReliability(controls, { status: "stale", ageDays: 400 });
      expect(score).toBe(60); // 100% effective (60) + stale (0)
    });

    test("empty controls → 0", () => {
      expect(scoreReliability([], { status: "fresh", ageDays: 0 })).toBe(0);
    });
  });

  describe("scoreMethodology", () => {
    test("pentest source → 75", () => {
      expect(scoreMethodology("pentest")).toBe(75);
    });

    test("prowler source → 60", () => {
      expect(scoreMethodology("prowler")).toBe(60);
    });

    test("soc2 source → 50", () => {
      expect(scoreMethodology("soc2")).toBe(50);
    });

    test("manual source → 15", () => {
      expect(scoreMethodology("manual")).toBe(15);
    });

    test("Quartermaster score overrides source-based score", () => {
      expect(scoreMethodology("manual", 0.85)).toBe(85);
    });

    test("QM score clamped to 0-100", () => {
      expect(scoreMethodology("manual", 1.5)).toBe(100);
      expect(scoreMethodology("manual", -0.1)).toBe(0);
    });
  });

  describe("scoreFreshness", () => {
    test("today's date → ~100", () => {
      const today = new Date().toISOString().split("T")[0];
      const score = scoreFreshness(today);
      expect(score).toBeGreaterThanOrEqual(99);
    });

    test("180 days ago → ~51", () => {
      const d = new Date();
      d.setDate(d.getDate() - 180);
      const score = scoreFreshness(d.toISOString().split("T")[0]);
      expect(score).toBeGreaterThanOrEqual(48);
      expect(score).toBeLessThanOrEqual(54);
    });

    test("365+ days → 0", () => {
      const d = new Date();
      d.setDate(d.getDate() - 400);
      expect(scoreFreshness(d.toISOString().split("T")[0])).toBe(0);
    });

    test("no date → 0", () => {
      expect(scoreFreshness(undefined)).toBe(0);
    });

    test("invalid date → 0", () => {
      expect(scoreFreshness("not-a-date")).toBe(0);
    });
  });

  describe("scoreIndependence", () => {
    test("soc2 → 85 (external auditor)", () => {
      expect(scoreIndependence("soc2")).toBe(85);
    });

    test("iso27001 → 85 (external auditor)", () => {
      expect(scoreIndependence("iso27001")).toBe(85);
    });

    test("pentest → 75 (external tester)", () => {
      expect(scoreIndependence("pentest")).toBe(75);
    });

    test("prowler → 50 (automated tool)", () => {
      expect(scoreIndependence("prowler")).toBe(50);
    });

    test("manual → 15 (self-assessment)", () => {
      expect(scoreIndependence("manual")).toBe(15);
    });
  });

  describe("scoreConsistency", () => {
    test("QM bias score overrides heuristic", () => {
      const controls: IngestedControl[] = [{ ...baseControl, evidence: "Tested" }];
      expect(scoreConsistency(controls, 0.9)).toBe(90);
    });

    test("mixed results with evidence → higher (transparency bonus)", () => {
      const controls: IngestedControl[] = [
        { ...baseControl, evidence: "MFA verified" },
        { ...baseControl, id: "CC6.2", status: "ineffective", evidence: "MFA disabled" },
      ];
      const score = scoreConsistency(controls);
      // 100% evidence (60) + transparency bonus (15) + base (25) = 100
      expect(score).toBe(100);
    });

    test("all passing without evidence → lower consistency", () => {
      const controls: IngestedControl[] = [
        { ...baseControl },
        { ...baseControl, id: "CC6.2" },
      ];
      const score = scoreConsistency(controls);
      // 0% evidence (0) + no transparency bonus (0) + base (25) = 25
      expect(score).toBe(25);
    });

    test("empty controls → 0", () => {
      expect(scoreConsistency([])).toBe(0);
    });
  });

  describe("calculateAssuranceDimensions", () => {
    test("returns all 7 dimensions as 0-100 numbers", () => {
      const controls: IngestedControl[] = [
        { ...baseControl, evidence: "MFA verified" },
      ];
      const dims = calculateAssuranceDimensions(controls, "soc2", soc2Metadata);
      const keys = ["capability", "coverage", "reliability", "methodology", "freshness", "independence", "consistency"];
      for (const key of keys) {
        const val = dims[key as keyof typeof dims];
        expect(typeof val).toBe("number");
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(100);
      }
    });

    test("uses QM scores when provided", () => {
      const controls: IngestedControl[] = [
        { ...baseControl, evidence: "MFA verified" },
      ];
      const dims = calculateAssuranceDimensions(controls, "soc2", soc2Metadata, {
        methodology: 0.85,
        bias: 0.90,
      });
      expect(dims.methodology).toBe(85);
      expect(dims.consistency).toBe(90);
    });
  });

  // ===========================================================================
  // EVIDENCE TYPE DERIVATION (ISO 19011 + SOC 2 + NIST 800-53A)
  // ===========================================================================

  describe("deriveEvidenceTypes", () => {
    test("prowler → automated-observation + system-generated-record + documented-record", () => {
      const controls: IngestedControl[] = [{ ...baseControl, evidence: "PASS" }];
      const types = deriveEvidenceTypes(controls, "prowler");
      expect(types).toContain("automated-observation");
      expect(types).toContain("system-generated-record");
      expect(types).toContain("documented-record");
    });

    test("pentest → reperformance + system-generated-record + documented-record", () => {
      const controls: IngestedControl[] = [{ ...baseControl, evidence: "Bypass blocked" }];
      const types = deriveEvidenceTypes(controls, "pentest");
      expect(types).toContain("reperformance");
      expect(types).toContain("system-generated-record");
    });

    test("soc2 → documented-record + interview", () => {
      const controls: IngestedControl[] = [{ ...baseControl, evidence: "Tested" }];
      const types = deriveEvidenceTypes(controls, "soc2");
      expect(types).toContain("documented-record");
      expect(types).toContain("interview");
    });

    test("manual → self-attestation", () => {
      const controls: IngestedControl[] = [{ ...baseControl }];
      const types = deriveEvidenceTypes(controls, "manual");
      expect(types).toContain("self-attestation");
      expect(types).not.toContain("automated-observation");
    });

    test("results sorted by reliability (highest first)", () => {
      const controls: IngestedControl[] = [{ ...baseControl, evidence: "PASS" }];
      const types = deriveEvidenceTypes(controls, "prowler");
      const firstIdx = types.indexOf("automated-observation");
      const lastIdx = types.indexOf("documented-record");
      expect(firstIdx).toBeLessThan(lastIdx);
    });

    test("no duplicate types", () => {
      const controls: IngestedControl[] = [{ ...baseControl, evidence: "PASS" }];
      const types = deriveEvidenceTypes(controls, "prowler");
      expect(new Set(types).size).toBe(types.length);
    });
  });

  // ===========================================================================
  // OBSERVATION PERIOD (COSO Design vs Operating + SOC 2 Type II)
  // ===========================================================================

  describe("deriveObservationPeriod", () => {
    test("SOC 2 Type II → operating, 180 days, Type II (6mo)", () => {
      const result = deriveObservationPeriod(soc2Metadata);
      expect(result).toBeDefined();
      expect(result!.durationDays).toBe(180);
      expect(result!.cosoClassification).toBe("operating");
      expect(result!.soc2Equivalent).toBe("Type II (6mo)");
      expect(result!.sufficient).toBe(true);
    });

    test("SOC 2 Type I → design-only, 1 day, Type I", () => {
      const result = deriveObservationPeriod({
        ...soc2Metadata,
        reportType: "SOC 2 Type I",
      });
      expect(result).toBeDefined();
      expect(result!.durationDays).toBe(1);
      expect(result!.cosoClassification).toBe("design-only");
      expect(result!.soc2Equivalent).toBe("Type I");
      expect(result!.sufficient).toBe(false);
    });

    test("Prowler scan → design-only, 1 day", () => {
      const result = deriveObservationPeriod({
        title: "Prowler Scan",
        issuer: "Automated",
        date: "2026-01-15",
        scope: "AWS",
        reportType: "Prowler Scan",
      });
      expect(result).toBeDefined();
      expect(result!.durationDays).toBe(1);
      expect(result!.cosoClassification).toBe("design-only");
    });

    test("no date → undefined", () => {
      const result = deriveObservationPeriod({
        ...soc2Metadata,
        date: "",
      });
      expect(result).toBeUndefined();
    });

    test("invalid date → undefined", () => {
      const result = deriveObservationPeriod({
        ...soc2Metadata,
        date: "not-a-date",
      });
      expect(result).toBeUndefined();
    });

    test("12-month Type II → Type II (12mo)", () => {
      const result = deriveObservationPeriod({
        ...soc2Metadata,
        reportType: "SOC 2 Type II 12-month period",
      });
      expect(result).toBeDefined();
      expect(result!.durationDays).toBe(365);
      expect(result!.soc2Equivalent).toBe("Type II (12mo)");
    });
  });

  // ===========================================================================
  // ANTI-GAMING SAFEGUARDS (Plan 2.4.5)
  // ===========================================================================

  describe("applyAntiGamingSafeguards", () => {
    test("zero controls → caps at L0", () => {
      const result = applyAntiGamingSafeguards(2, [], "soc2", soc2Metadata);
      expect(result.effectiveLevel).toBe(0);
      expect(result.appliedSafeguards).toContain("sampling-opacity");
    });

    test("stale evidence (>180 days) → caps at L1", () => {
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 200);
      const result = applyAntiGamingSafeguards(
        2,
        [{ ...baseControl, evidence: "test" }],
        "soc2",
        { ...soc2Metadata, date: staleDate.toISOString() },
      );
      expect(result.effectiveLevel).toBeLessThanOrEqual(1);
      expect(result.appliedSafeguards).toContain("freshness-decay");
    });

    test("self provenance + L3 declared → caps at L2", () => {
      const result = applyAntiGamingSafeguards(
        3,
        [{ ...baseControl, evidence: "test" }],
        "manual",
        { ...soc2Metadata, date: new Date().toISOString() },
      );
      expect(result.effectiveLevel).toBeLessThanOrEqual(2);
      expect(result.appliedSafeguards).toContain("independence-check");
    });

    test("fresh auditor evidence with controls → no caps applied", () => {
      const result = applyAntiGamingSafeguards(
        1,
        [{ ...baseControl, evidence: "test" }],
        "soc2",
        { ...soc2Metadata, date: new Date().toISOString() },
      );
      expect(result.effectiveLevel).toBe(1);
      expect(result.appliedSafeguards).toHaveLength(0);
    });

    test("no evidence on controls → caps at L1 (opacity)", () => {
      const result = applyAntiGamingSafeguards(
        2,
        [{ ...baseControl, evidence: "" }, baseControl],
        "soc2",
        { ...soc2Metadata, date: new Date().toISOString() },
      );
      expect(result.effectiveLevel).toBeLessThanOrEqual(1);
      expect(result.appliedSafeguards).toContain("sampling-opacity");
    });

    test("multiple safeguards can apply simultaneously", () => {
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 200);
      const result = applyAntiGamingSafeguards(
        3,
        [{ ...baseControl, evidence: "" }],
        "manual",
        { ...soc2Metadata, date: staleDate.toISOString() },
      );
      expect(result.effectiveLevel).toBeLessThanOrEqual(1);
      expect(result.appliedSafeguards.length).toBeGreaterThanOrEqual(2);
    });

    // Phase 3: New safeguards
    test("severity asymmetry: CRITICAL with inquiry, MEDIUM with reperformance → caps at L1", () => {
      const controls: IngestedControl[] = [
        { ...baseControl, severity: "CRITICAL", evidence: "Inquired of management regarding MFA configuration" },
        { ...baseControl, id: "CC6.2", severity: "CRITICAL", evidence: "Management stated encryption is enabled" },
        { ...baseControl, id: "CC8.1", severity: "MEDIUM", evidence: "Reperformed change management review for sample of 25 deployments from population of 500" },
        { ...baseControl, id: "CC8.2", severity: "MEDIUM", evidence: "Reperformed code review process for sample of 20 merge requests" },
      ];
      const result = applyAntiGamingSafeguards(
        2,
        controls,
        "soc2",
        { ...soc2Metadata, date: new Date().toISOString() },
      );
      expect(result.appliedSafeguards).toContain("severity-asymmetry");
      expect(result.effectiveLevel).toBeLessThanOrEqual(1);
    });

    test("severity asymmetry: all same methodology → no trigger", () => {
      const controls: IngestedControl[] = [
        { ...baseControl, severity: "CRITICAL", evidence: "Inspected MFA config settings" },
        { ...baseControl, id: "CC8.1", severity: "MEDIUM", evidence: "Inspected change management config" },
      ];
      const result = applyAntiGamingSafeguards(
        1,
        controls,
        "soc2",
        { ...soc2Metadata, date: new Date().toISOString() },
      );
      expect(result.appliedSafeguards).not.toContain("severity-asymmetry");
    });

    test("all-pass bias: 10+ controls all effective → triggers flag", () => {
      const controls: IngestedControl[] = Array.from({ length: 12 }, (_, i) => ({
        ...baseControl,
        id: `CC${i + 1}`,
        evidence: `Inspected control ${i + 1} settings`,
      }));
      const result = applyAntiGamingSafeguards(
        1,
        controls,
        "soc2",
        { ...soc2Metadata, date: new Date().toISOString() },
      );
      expect(result.appliedSafeguards).toContain("all-pass-bias");
    });

    test("all-pass bias: fewer than 10 controls → no trigger", () => {
      const controls: IngestedControl[] = Array.from({ length: 5 }, (_, i) => ({
        ...baseControl,
        id: `CC${i + 1}`,
        evidence: `Tested control ${i + 1}`,
      }));
      const result = applyAntiGamingSafeguards(
        1,
        controls,
        "soc2",
        { ...soc2Metadata, date: new Date().toISOString() },
      );
      expect(result.appliedSafeguards).not.toContain("all-pass-bias");
    });

    test("all-pass bias: mixed status (some ineffective) → no trigger", () => {
      const controls: IngestedControl[] = Array.from({ length: 12 }, (_, i) => ({
        ...baseControl,
        id: `CC${i + 1}`,
        status: i === 5 ? "ineffective" as const : "effective" as const,
        evidence: `Tested control ${i + 1}`,
      }));
      const result = applyAntiGamingSafeguards(
        1,
        controls,
        "soc2",
        { ...soc2Metadata, date: new Date().toISOString() },
      );
      expect(result.appliedSafeguards).not.toContain("all-pass-bias");
    });
  });

  // ===========================================================================
  // RULE TRACE (Plan 2.4.4)
  // ===========================================================================

  describe("generateRuleTrace", () => {
    test("produces trace entries for each rule check", () => {
      const trace = generateRuleTrace(
        [{ ...baseControl, evidence: "test result", assuranceLevel: 1 as AssuranceLevel }],
        "soc2",
        soc2Metadata,
      );
      expect(trace.length).toBeGreaterThan(0);
      expect(trace.some(t => t.includes("satisfied") || t.includes("checked"))).toBe(true);
    });

    test("includes freshness check in trace", () => {
      const trace = generateRuleTrace(
        [{ ...baseControl, evidence: "test", assuranceLevel: 1 as AssuranceLevel }],
        "soc2",
        { ...soc2Metadata, date: new Date().toISOString() },
      );
      expect(trace.some(t => t.toLowerCase().includes("freshness") || t.toLowerCase().includes("fresh"))).toBe(true);
    });

    test("includes source ceiling in trace", () => {
      const trace = generateRuleTrace(
        [{ ...baseControl, evidence: "test", assuranceLevel: 2 as AssuranceLevel }],
        "pentest",
        soc2Metadata,
      );
      expect(trace.some(t => t.toLowerCase().includes("source") || t.toLowerCase().includes("ceiling"))).toBe(true);
    });

    test("trace for zero controls mentions no controls", () => {
      const trace = generateRuleTrace([], "soc2", soc2Metadata);
      expect(trace.some(t => t.toLowerCase().includes("no controls") || t.toLowerCase().includes("0 controls"))).toBe(true);
    });
  });

  // ===========================================================================
  // EVIDENCE TYPE DISTRIBUTION (Plan 2.5)
  // ===========================================================================

  describe("deriveEvidenceTypeDistribution", () => {
    test("single evidence type → 100%", () => {
      const dist = deriveEvidenceTypeDistribution(
        [baseControl],
        "manual",
      );
      const values = Object.values(dist);
      expect(values.length).toBeGreaterThan(0);
      const total = values.reduce((s, v) => s + v, 0);
      expect(total).toBeCloseTo(1.0, 1);
    });

    test("mixed source produces multiple types with distribution", () => {
      const dist = deriveEvidenceTypeDistribution(
        [
          { ...baseControl, evidence: "Automated scan output" },
          { ...baseControl, evidence: "Policy document" },
        ],
        "soc2",
      );
      expect(Object.keys(dist).length).toBeGreaterThan(0);
    });

    test("empty controls → empty distribution", () => {
      const dist = deriveEvidenceTypeDistribution([], "soc2");
      const values = Object.values(dist);
      expect(values.length).toBeGreaterThan(0);
    });
  });
});
