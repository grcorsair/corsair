/**
 * MARK ISC Integration Test Contract - RED PHASE
 *
 * Tests the integration of ISC satisfaction tracking with MARK drift detection.
 * When MARK detects drift, it should update ISC satisfaction status.
 *
 * Contract Requirements:
 * 1. Drift detection SHOULD update ISC satisfaction to FAILED
 * 2. No drift SHOULD update ISC satisfaction to SATISFIED
 * 3. Evidence MUST be linked to criteria when drift is found
 * 4. Multiple MARK results SHOULD update multiple criteria
 * 5. Unknown fields SHOULD be handled gracefully
 * 6. ISC state SHOULD persist after MARK execution
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { ISCManager } from "../../src/core/isc-manager";
import type { DriftFinding, MarkResult, Expectation } from "../../src/types";

// Helper to create a mock MARK result
function createMockMarkResult(findings: Partial<DriftFinding>[]): MarkResult {
  return {
    findings: findings.map((f, i) => ({
      id: f.id || `DRIFT-${i}`,
      field: f.field || "unknown",
      expected: f.expected ?? "expected",
      actual: f.actual ?? "actual",
      drift: f.drift ?? true,
      severity: f.severity || "MEDIUM",
      description: f.description || "Test drift finding",
      timestamp: f.timestamp || new Date().toISOString(),
    })),
    driftDetected: findings.some(f => f.drift !== false),
    durationMs: 10,
  };
}

// Helper function to update ISC based on MARK results
function updateISCFromMarkResult(iscManager: ISCManager, markResult: MarkResult): void {
  for (const finding of markResult.findings) {
    // Find matching criterion by field
    const matchingCriterionId = findMatchingCriterion(iscManager, finding.field);

    if (matchingCriterionId) {
      if (finding.drift) {
        // Drift detected = criterion not satisfied
        iscManager.verifyCriterion(matchingCriterionId, false, finding.id);
      } else {
        // No drift = criterion satisfied
        iscManager.verifyCriterion(matchingCriterionId, true, finding.id);
      }
    }
  }
}

// Helper function to find matching criterion for a field
function findMatchingCriterion(iscManager: ISCManager, field: string): string | null {
  const criteria = iscManager.getCriteria();
  const fieldLower = field.toLowerCase();

  // Map common drift fields to criterion keywords
  const fieldKeywords: Record<string, string[]> = {
    mfaconfiguration: ["mfa", "multi-factor", "authentication"],
    "passwordpolicy.minimumlength": ["password", "length", "minimum"],
    "passwordpolicy.requiresymbols": ["password", "symbols", "special"],
    riskconfiguration: ["risk", "compromise", "detection"],
    publicaccessblock: ["public", "access", "blocked"],
    encryption: ["encrypt", "aes", "kms"],
    versioning: ["version", "backup", "recovery"],
    logging: ["log", "audit", "monitor"],
  };

  const keywords = fieldKeywords[fieldLower] || [fieldLower.replace(/\./g, " ")];

  for (const criterion of criteria) {
    const criterionLower = criterion.text.toLowerCase();
    for (const keyword of keywords) {
      if (criterionLower.includes(keyword)) {
        return criterion.id;
      }
    }
  }

  return null;
}

describe("MARK ISC Integration", () => {
  const testDir = "/tmp/corsair-mark-isc-tests";
  let iscManager: ISCManager;

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    fs.mkdirSync(testDir, { recursive: true });

    // Create ISC manager with criteria
    iscManager = new ISCManager("mission_mark_test");
    iscManager.addCriteria([
      "MFA required for all user accounts",
      "Public access blocked at bucket level",
      "Encryption enabled using AES256 algorithm",
      "Versioning enabled for data protection",
    ]);
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  // Test 1: Drift detection updates ISC satisfaction to FAILED
  test("drift detection updates ISC satisfaction to FAILED", () => {
    const markResult = createMockMarkResult([
      {
        id: "DRIFT-mfa-001",
        field: "mfaConfiguration",
        expected: "ON",
        actual: "OFF",
        drift: true,
        severity: "CRITICAL",
      },
    ]);

    updateISCFromMarkResult(iscManager, markResult);

    // Find the MFA criterion
    const criteria = iscManager.getCriteria();
    const mfaCriterion = criteria.find(c => c.text.toLowerCase().includes("mfa"));

    expect(mfaCriterion).toBeDefined();
    expect(mfaCriterion?.satisfaction).toBe("FAILED");
    expect(mfaCriterion?.evidenceRefs).toContain("DRIFT-mfa-001");
  });

  // Test 2: No drift updates ISC satisfaction to SATISFIED
  test("no drift updates ISC satisfaction to SATISFIED", () => {
    const markResult = createMockMarkResult([
      {
        id: "DRIFT-encryption-001",
        field: "encryption",
        expected: "AES256",
        actual: "AES256",
        drift: false,
        severity: "LOW",
      },
    ]);

    updateISCFromMarkResult(iscManager, markResult);

    // Find the encryption criterion
    const criteria = iscManager.getCriteria();
    const encryptionCriterion = criteria.find(c => c.text.toLowerCase().includes("encryption"));

    expect(encryptionCriterion).toBeDefined();
    expect(encryptionCriterion?.satisfaction).toBe("SATISFIED");
    expect(encryptionCriterion?.evidenceRefs).toContain("DRIFT-encryption-001");
  });

  // Test 3: Evidence is linked to criteria
  test("evidence is linked to criteria when drift is found", () => {
    const markResult = createMockMarkResult([
      {
        id: "DRIFT-public-001",
        field: "publicAccessBlock",
        expected: true,
        actual: false,
        drift: true,
        severity: "HIGH",
      },
    ]);

    updateISCFromMarkResult(iscManager, markResult);

    const criteria = iscManager.getCriteria();
    const publicCriterion = criteria.find(c => c.text.toLowerCase().includes("public"));

    expect(publicCriterion).toBeDefined();
    expect(publicCriterion?.evidenceRefs.length).toBeGreaterThan(0);
    expect(publicCriterion?.verifiedAt).toBeDefined();
    expect(publicCriterion?.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  // Test 4: Multiple MARK results update multiple criteria
  test("multiple MARK results update multiple criteria", () => {
    const markResult = createMockMarkResult([
      {
        id: "DRIFT-mfa-001",
        field: "mfaConfiguration",
        drift: true,
      },
      {
        id: "DRIFT-encryption-001",
        field: "encryption",
        drift: false,
      },
      {
        id: "DRIFT-versioning-001",
        field: "versioning",
        drift: true,
      },
    ]);

    updateISCFromMarkResult(iscManager, markResult);

    const criteria = iscManager.getCriteria();

    const mfaCriterion = criteria.find(c => c.text.toLowerCase().includes("mfa"));
    expect(mfaCriterion?.satisfaction).toBe("FAILED");

    const encryptionCriterion = criteria.find(c => c.text.toLowerCase().includes("encryption"));
    expect(encryptionCriterion?.satisfaction).toBe("SATISFIED");

    const versioningCriterion = criteria.find(c => c.text.toLowerCase().includes("versioning"));
    expect(versioningCriterion?.satisfaction).toBe("FAILED");

    // Check satisfaction rate
    // 1 SATISFIED out of 4 (public access is still PENDING) = 25%
    expect(iscManager.getSatisfactionRate()).toBe(25);
  });

  // Test 5: Unknown fields are handled gracefully
  test("unknown fields are handled gracefully", () => {
    const markResult = createMockMarkResult([
      {
        id: "DRIFT-unknown-001",
        field: "someUnknownField",
        drift: true,
      },
    ]);

    // Should not throw
    expect(() => updateISCFromMarkResult(iscManager, markResult)).not.toThrow();

    // All criteria should still be PENDING (no match found)
    const criteria = iscManager.getCriteria();
    const pendingCount = criteria.filter(c => c.satisfaction === "PENDING").length;
    expect(pendingCount).toBe(4);
  });

  // Test 6: ISC state persists after MARK execution
  test("ISC state persists after MARK execution", async () => {
    const markResult = createMockMarkResult([
      {
        id: "DRIFT-mfa-001",
        field: "mfaConfiguration",
        drift: true,
      },
      {
        id: "DRIFT-encryption-001",
        field: "encryption",
        drift: false,
      },
    ]);

    updateISCFromMarkResult(iscManager, markResult);

    // Persist to file
    const filePath = path.join(testDir, "mission_mark_test", "ISC.json");
    await iscManager.persist(filePath);

    // Load and verify
    const loaded = await ISCManager.load(filePath);
    const criteria = loaded.getCriteria();

    const mfaCriterion = criteria.find(c => c.text.toLowerCase().includes("mfa"));
    expect(mfaCriterion?.satisfaction).toBe("FAILED");
    expect(mfaCriterion?.evidenceRefs).toContain("DRIFT-mfa-001");

    const encryptionCriterion = criteria.find(c => c.text.toLowerCase().includes("encryption"));
    expect(encryptionCriterion?.satisfaction).toBe("SATISFIED");
    expect(encryptionCriterion?.evidenceRefs).toContain("DRIFT-encryption-001");
  });
});

describe("MARK ISC Integration - Edge Cases", () => {
  test("handles empty MARK results gracefully", () => {
    const iscManager = new ISCManager("mission_empty_mark");
    iscManager.addCriteria(["Test criterion one here"]);

    const markResult = createMockMarkResult([]);

    // Should not throw
    expect(() => updateISCFromMarkResult(iscManager, markResult)).not.toThrow();

    // Criterion should still be PENDING
    const criterion = iscManager.getCriteria()[0];
    expect(criterion.satisfaction).toBe("PENDING");
  });

  test("handles ISC with no criteria gracefully", () => {
    const iscManager = new ISCManager("mission_no_criteria");

    const markResult = createMockMarkResult([
      {
        id: "DRIFT-test-001",
        field: "testField",
        drift: true,
      },
    ]);

    // Should not throw
    expect(() => updateISCFromMarkResult(iscManager, markResult)).not.toThrow();
    expect(iscManager.getSatisfactionRate()).toBe(0);
  });

  test("handles multiple drift findings for same field", () => {
    const iscManager = new ISCManager("mission_multiple");
    iscManager.addCriterion("MFA required for users");

    const markResult = createMockMarkResult([
      {
        id: "DRIFT-mfa-001",
        field: "mfaConfiguration",
        drift: true,
      },
      {
        id: "DRIFT-mfa-002",
        field: "mfaConfiguration",
        drift: false, // Second check shows no drift
      },
    ]);

    // Process all findings
    updateISCFromMarkResult(iscManager, markResult);

    // Last result should win (SATISFIED)
    const criterion = iscManager.getCriteria()[0];
    expect(criterion.satisfaction).toBe("SATISFIED");

    // Both evidence refs should be present
    expect(criterion.evidenceRefs).toContain("DRIFT-mfa-001");
    expect(criterion.evidenceRefs).toContain("DRIFT-mfa-002");
  });
});
