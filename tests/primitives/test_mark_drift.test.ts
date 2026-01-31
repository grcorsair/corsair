/**
 * MARK Primitive Test Contract
 *
 * MARK identifies drift by comparing observed reality vs expectations.
 * It produces a list of DriftFindings with severity and evidence.
 *
 * Contract Requirements:
 * 1. MARK MUST accept CognitoSnapshot and expectations
 * 2. MARK MUST return DriftFindings array
 * 3. MARK MUST detect MFA drift (OFF when expected ON)
 * 4. MARK MUST detect password policy drift
 * 5. MARK MUST detect risk configuration absence
 * 6. MARK MUST assign severity levels (CRITICAL, HIGH, MEDIUM, LOW)
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { Corsair, DriftFinding, Expectation, Severity, MarkResult } from "../../src/corsair-mvp";

describe("MARK Primitive - Drift Detection", () => {
  let corsair: Corsair;
  const fixtureCompliant = "./tests/fixtures/cognito-userpool-compliant.json";
  const fixtureNonCompliant = "./tests/fixtures/cognito-userpool-noncompliant.json";
  const fixtureOptionalMfa = "./tests/fixtures/cognito-userpool-optional-mfa.json";
  const fixtureWeakPassword = "./tests/fixtures/cognito-userpool-weak-password.json";
  const fixtureNoRisk = "./tests/fixtures/cognito-userpool-no-risk-config.json";

  beforeAll(() => {
    corsair = new Corsair();
  });

  test("MARK detects MFA drift when OFF but expected ON", async () => {
    const snapshot = (await corsair.recon(fixtureNonCompliant)).snapshot;

    const expectations: Expectation[] = [
      { field: "mfaConfiguration", operator: "eq", value: "ON" }
    ];

    const result = await corsair.mark(snapshot, expectations);

    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.driftDetected).toBe(true);

    const mfaDrift = result.findings.find(f => f.field === "mfaConfiguration");
    expect(mfaDrift).toBeDefined();
    expect(mfaDrift?.severity).toBe("CRITICAL");
    expect(mfaDrift?.expected).toBe("ON");
    expect(mfaDrift?.actual).toBe("OFF");
    expect(mfaDrift?.drift).toBe(true);
  });

  test("MARK detects OPTIONAL MFA as drift when ON is expected", async () => {
    const snapshot = (await corsair.recon(fixtureOptionalMfa)).snapshot;

    const expectations: Expectation[] = [
      { field: "mfaConfiguration", operator: "eq", value: "ON" }
    ];

    const result = await corsair.mark(snapshot, expectations);

    const mfaDrift = result.findings.find(f => f.field === "mfaConfiguration");
    expect(mfaDrift).toBeDefined();
    expect(mfaDrift?.severity).toBe("HIGH");
    expect(mfaDrift?.actual).toBe("OPTIONAL");
    expect(mfaDrift?.drift).toBe(true);
  });

  test("MARK detects no drift when compliant", async () => {
    const snapshot = (await corsair.recon(fixtureCompliant)).snapshot;

    const expectations: Expectation[] = [
      { field: "mfaConfiguration", operator: "eq", value: "ON" },
      { field: "passwordPolicy.minimumLength", operator: "gte", value: 12 },
      { field: "riskConfiguration", operator: "exists", value: true }
    ];

    const result = await corsair.mark(snapshot, expectations);

    // All should pass - no drift
    const driftFound = result.findings.filter(f => f.drift === true);
    expect(driftFound.length).toBe(0);
    expect(result.driftDetected).toBe(false);
  });

  test("MARK detects weak password policy drift", async () => {
    const snapshot = (await corsair.recon(fixtureWeakPassword)).snapshot;

    const expectations: Expectation[] = [
      { field: "passwordPolicy.minimumLength", operator: "gte", value: 12 },
      { field: "passwordPolicy.requireSymbols", operator: "eq", value: true }
    ];

    const result = await corsair.mark(snapshot, expectations);

    const lengthDrift = result.findings.find(f => f.field === "passwordPolicy.minimumLength");
    expect(lengthDrift).toBeDefined();
    expect(lengthDrift?.drift).toBe(true);
    expect(lengthDrift?.severity).toBe("MEDIUM");
    expect(lengthDrift?.actual).toBe(8);

    const symbolsDrift = result.findings.find(f => f.field === "passwordPolicy.requireSymbols");
    expect(symbolsDrift).toBeDefined();
    expect(symbolsDrift?.drift).toBe(true);
  });

  test("MARK detects missing risk configuration as drift", async () => {
    const snapshot = (await corsair.recon(fixtureNoRisk)).snapshot;

    const expectations: Expectation[] = [
      { field: "riskConfiguration", operator: "exists", value: true }
    ];

    const result = await corsair.mark(snapshot, expectations);

    const riskDrift = result.findings.find(f => f.field === "riskConfiguration");
    expect(riskDrift).toBeDefined();
    expect(riskDrift?.drift).toBe(true);
    expect(riskDrift?.severity).toBe("HIGH");
  });

  test("MARK returns DriftFinding with complete structure", async () => {
    const snapshot = (await corsair.recon(fixtureNonCompliant)).snapshot;

    const expectations: Expectation[] = [
      { field: "mfaConfiguration", operator: "eq", value: "ON" }
    ];

    const result = await corsair.mark(snapshot, expectations);
    const finding = result.findings[0];

    expect(finding).toHaveProperty("id");
    expect(finding).toHaveProperty("field");
    expect(finding).toHaveProperty("expected");
    expect(finding).toHaveProperty("actual");
    expect(finding).toHaveProperty("drift");
    expect(finding).toHaveProperty("severity");
    expect(finding).toHaveProperty("description");
    expect(finding).toHaveProperty("timestamp");
    expect(finding.id).toMatch(/^DRIFT-/);
  });

  test("MARK assigns correct severity levels", async () => {
    const validSeverities: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

    const snapshot = (await corsair.recon(fixtureNonCompliant)).snapshot;

    const expectations: Expectation[] = [
      { field: "mfaConfiguration", operator: "eq", value: "ON" }
    ];

    const result = await corsair.mark(snapshot, expectations);

    for (const finding of result.findings) {
      expect(validSeverities).toContain(finding.severity);
    }
  });
});
