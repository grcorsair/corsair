import { describe, test, expect } from "bun:test";
import {
  classifyEvidenceContent,
  extractSampleSize,
  detectBoilerplate,
} from "../../src/ingestion/assurance-calculator";
import type { IngestedControl, DocumentSource } from "../../src/ingestion/types";

// =============================================================================
// HELPERS
// =============================================================================

const baseControl: IngestedControl = {
  id: "CC6.1",
  description: "Logical access security",
  status: "effective",
};

function ctrl(evidence: string, overrides?: Partial<IngestedControl>): IngestedControl {
  return { ...baseControl, evidence, ...overrides };
}

// =============================================================================
// 1A: METHODOLOGY CLASSIFICATION (Probo Check 3)
// =============================================================================

describe("classifyEvidenceContent", () => {
  describe("methodology tier classification", () => {
    test("reperformance keywords → reperformance tier, max L2", () => {
      const result = classifyEvidenceContent(
        ctrl("Reperformed MFA enrollment process for a sample of 25 users from a population of 1,247"),
        "soc2",
      );
      expect(result.methodology).toBe("reperformance");
      expect(result.maxLevel).toBe(2);
    });

    test("CAAT/automated keywords → caat tier, max L2", () => {
      const result = classifyEvidenceContent(
        ctrl("Automated scan of IAM configurations using Prowler tool output confirmed all settings compliant"),
        "soc2",
      );
      expect(result.methodology).toBe("caat");
      expect(result.maxLevel).toBe(2);
    });

    test("inspection + config keywords → inspection tier, max L1", () => {
      const result = classifyEvidenceContent(
        ctrl("Inspected MFA configuration settings and examined the config export from Okta admin console"),
        "soc2",
      );
      expect(result.methodology).toBe("inspection");
      expect(result.maxLevel).toBeGreaterThanOrEqual(1);
    });

    test("observation keywords → observation tier, max L1", () => {
      const result = classifyEvidenceContent(
        ctrl("Observed the access provisioning walkthrough demonstrated by the IT administrator"),
        "soc2",
      );
      expect(result.methodology).toBe("observation");
      expect(result.maxLevel).toBe(1);
    });

    test("inquiry only → inquiry tier, max L0-L1", () => {
      const result = classifyEvidenceContent(
        ctrl("Inquired of management regarding the access review process. Management stated reviews are performed quarterly."),
        "soc2",
      );
      expect(result.methodology).toBe("inquiry");
      expect(result.maxLevel).toBeLessThanOrEqual(1);
    });

    test("non-empty evidence with no methodology keywords → unknown", () => {
      const result = classifyEvidenceContent(
        ctrl("Control is operating effectively"),
        "soc2",
      );
      expect(result.methodology).toBe("unknown");
    });

    test("empty evidence → none", () => {
      const result = classifyEvidenceContent(
        ctrl(""),
        "soc2",
      );
      expect(result.methodology).toBe("none");
    });

    test("whitespace-only evidence → none", () => {
      const result = classifyEvidenceContent(
        ctrl("   \n  "),
        "soc2",
      );
      expect(result.methodology).toBe("none");
    });

    test("multiple methodology types takes highest tier", () => {
      const result = classifyEvidenceContent(
        ctrl("Inquired of management and reperformed the access review for a sample of 25 users"),
        "soc2",
      );
      // reperformance is highest
      expect(result.methodology).toBe("reperformance");
    });

    test("source ceiling still caps level — manual + reperformance = still L0", () => {
      const result = classifyEvidenceContent(
        ctrl("Reperformed MFA enrollment for 25 users"),
        "manual",
      );
      expect(result.methodology).toBe("reperformance");
      expect(result.maxLevel).toBe(0); // manual ceiling = L0
    });

    test("pentest source allows L2", () => {
      const result = classifyEvidenceContent(
        ctrl("Attempted MFA bypass using credential stuffing — blocked successfully"),
        "pentest",
      );
      expect(result.maxLevel).toBe(2);
    });

    test("classification trace is human-readable", () => {
      const result = classifyEvidenceContent(
        ctrl("Reperformed MFA check for sample of 25"),
        "soc2",
      );
      expect(result.trace).toBeDefined();
      expect(result.trace.length).toBeGreaterThan(0);
      expect(typeof result.trace).toBe("string");
    });

    test("sample of N pattern detected as reperformance", () => {
      const result = classifyEvidenceContent(
        ctrl("Selected a sample of 30 daily access logs and verified completeness"),
        "soc2",
      );
      expect(result.methodology).toBe("reperformance");
    });
  });
});

// =============================================================================
// 1B: SAMPLE SIZE ADEQUACY (Probo Check 5)
// =============================================================================

describe("extractSampleSize", () => {
  test("extracts sample and population from standard pattern", () => {
    const result = extractSampleSize(
      "Selected a sample of 25 from a population of 1,247 daily transactions"
    );
    expect(result.sample).toBe(25);
    expect(result.population).toBe(1247);
    expect(result.frequency).toBe("daily");
    expect(result.adequate).toBe(true); // 25 >= 25 for daily
  });

  test("inadequate sample for daily controls", () => {
    const result = extractSampleSize(
      "Tested 3 daily controls from the audit period"
    );
    expect(result.sample).toBe(3);
    expect(result.frequency).toBe("daily");
    expect(result.adequate).toBe(false); // 3 < 25 for daily
  });

  test("adequate sample for quarterly controls", () => {
    const result = extractSampleSize(
      "Tested all 4 quarterly access reviews performed during the period"
    );
    expect(result.sample).toBe(4);
    expect(result.frequency).toBe("quarterly");
    expect(result.adequate).toBe(true); // 4 >= 2 for quarterly
  });

  test("adequate sample for annual controls", () => {
    const result = extractSampleSize(
      "Tested 1 annual risk assessment performed in March 2026"
    );
    expect(result.sample).toBe(1);
    expect(result.frequency).toBe("annually");
    expect(result.adequate).toBe(true); // 1 >= 1 for annual
  });

  test("adequate sample for weekly controls", () => {
    const result = extractSampleSize(
      "Selected 10 weekly vulnerability scan reports for review"
    );
    expect(result.sample).toBe(10);
    expect(result.frequency).toBe("weekly");
    expect(result.adequate).toBe(true); // 10 >= 10 for weekly
  });

  test("inadequate sample for monthly controls", () => {
    const result = extractSampleSize(
      "Selected 2 monthly backup verification reports"
    );
    expect(result.sample).toBe(2);
    expect(result.frequency).toBe("monthly");
    expect(result.adequate).toBe(false); // 2 < 5 for monthly
  });

  test("no sample size mentioned → null sample", () => {
    const result = extractSampleSize(
      "Reviewed evidence and determined control is operating effectively"
    );
    expect(result.sample).toBeNull();
    expect(result.adequate).toBeNull();
  });

  test("population extracted from 'out of N' pattern", () => {
    const result = extractSampleSize(
      "Tested 25 out of 500 daily password resets"
    );
    expect(result.sample).toBe(25);
    expect(result.population).toBe(500);
    expect(result.frequency).toBe("daily");
    expect(result.adequate).toBe(true);
  });

  test("population extracted from 'from N total' pattern", () => {
    const result = extractSampleSize(
      "Selected 30 from 2,000 total login events"
    );
    expect(result.sample).toBe(30);
    expect(result.population).toBe(2000);
  });
});

// =============================================================================
// 1C: BOILERPLATE / TEMPLATE DETECTION (Probo Check 2)
// =============================================================================

describe("detectBoilerplate", () => {
  test("identical evidence across 3+ controls → template flag", () => {
    const controls = [
      ctrl("Reviewed evidence and determined control is operating effectively", { id: "CC6.1" }),
      ctrl("Reviewed evidence and determined control is operating effectively", { id: "CC6.2" }),
      ctrl("Reviewed evidence and determined control is operating effectively", { id: "CC6.3" }),
      ctrl("Reviewed evidence and determined control is operating effectively", { id: "CC6.4" }),
      ctrl("Reviewed evidence and determined control is operating effectively", { id: "CC6.5" }),
    ];
    const result = detectBoilerplate(controls);
    expect(result.some(r => r.flags.includes("template"))).toBe(true);
  });

  test("short evidence < 20 chars for non-inquiry → shallow flag", () => {
    const controls = [
      ctrl("Passed", { id: "CC6.1" }),
    ];
    const result = detectBoilerplate(controls);
    expect(result[0].flags).toContain("shallow");
  });

  test("generic boilerplate without specifics → boilerplate flag", () => {
    const controls = [
      ctrl("Reviewed evidence and determined control is operating effectively", { id: "CC6.1" }),
    ];
    const result = detectBoilerplate(controls);
    expect(result[0].flags).toContain("generic-boilerplate");
  });

  test("specific evidence with named systems → no boilerplate flags", () => {
    const controls = [
      ctrl("Reperformed MFA enrollment for 25 Okta users in March 2026, zero exceptions noted", { id: "CC6.1" }),
    ];
    const result = detectBoilerplate(controls);
    // Should have high specificity, no boilerplate
    expect(result[0].flags).not.toContain("generic-boilerplate");
    expect(result[0].flags).not.toContain("template");
    expect(result[0].specificity).toBeGreaterThan(20);
  });

  test("specificity scoring: named systems add points", () => {
    const controls = [
      ctrl("Reperformed MFA enrollment for 25 Okta users in March 2026, zero exceptions noted", { id: "CC6.1" }),
    ];
    const result = detectBoilerplate(controls);
    // Named system (Okta) + date (March 2026) + procedure (reperformed MFA enrollment) + quantified (25, zero exceptions)
    expect(result[0].specificity).toBeGreaterThanOrEqual(40);
  });

  test("wordy but empty evidence → boilerplate flag", () => {
    const controls = [
      ctrl("The auditor reviewed the evidence provided by management and determined that the control is operating effectively based on the procedures performed during the audit period", { id: "CC6.1" }),
    ];
    const result = detectBoilerplate(controls);
    // Long text but no specifics — should be flagged
    expect(result[0].flags).toContain("generic-boilerplate");
  });

  test("2 controls with same evidence → no template flag (need 3+)", () => {
    const controls = [
      ctrl("Reviewed evidence and determined control is operating effectively", { id: "CC6.1" }),
      ctrl("Reviewed evidence and determined control is operating effectively", { id: "CC6.2" }),
    ];
    const result = detectBoilerplate(controls);
    expect(result.every(r => !r.flags.includes("template"))).toBe(true);
  });

  test("empty evidence → returns empty flags array", () => {
    const controls = [
      ctrl("", { id: "CC6.1" }),
    ];
    const result = detectBoilerplate(controls);
    expect(result[0].flags).toEqual([]);
  });

  test("controls without evidence are skipped", () => {
    const controls = [
      { ...baseControl, id: "CC6.1" }, // no evidence property
    ];
    const result = detectBoilerplate(controls);
    expect(result[0].flags).toEqual([]);
  });
});
