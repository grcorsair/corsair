/**
 * RECON Primitive Test Contract
 *
 * RECON observes AWS Cognito configuration WITHOUT modification.
 * This is a read-only reconnaissance operation that extracts state.
 *
 * Contract Requirements:
 * 1. RECON MUST return CognitoSnapshot type
 * 2. RECON MUST NOT modify any state
 * 3. RECON MUST capture MFA configuration
 * 4. RECON MUST capture password policy
 * 5. RECON MUST capture risk configuration
 * 6. RECON MUST include timestamp of observation
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { Corsair, CognitoSnapshot, ReconResult } from "../../src/corsair-mvp";

describe("RECON Primitive - Read-Only Observation", () => {
  let corsair: Corsair;
  const fixtureCompliant = "./tests/fixtures/cognito-userpool-compliant.json";
  const fixtureNonCompliant = "./tests/fixtures/cognito-userpool-noncompliant.json";

  beforeAll(() => {
    corsair = new Corsair();
  });

  test("RECON returns CognitoSnapshot type with required fields", async () => {
    const result: ReconResult = await corsair.recon(fixtureCompliant);

    expect(result).toBeDefined();
    expect(result.snapshot).toBeDefined();
    expect(result.snapshot.userPoolId).toBe("us-west-2_COMPLIANT001");
    expect(result.snapshot.mfaConfiguration).toBeDefined();
    expect(result.snapshot.passwordPolicy).toBeDefined();
    expect(result.snapshot.riskConfiguration).toBeDefined();
    expect(result.snapshot.observedAt).toBeDefined();
    expect(typeof result.snapshot.observedAt).toBe("string");
  });

  test("RECON captures MFA configuration accurately", async () => {
    // Test compliant pool (MFA ON)
    const compliant = await corsair.recon(fixtureCompliant);
    expect(compliant.snapshot.mfaConfiguration).toBe("ON");
    expect(compliant.snapshot.softwareTokenMfaEnabled).toBe(true);
    expect(compliant.snapshot.smsMfaEnabled).toBe(true);

    // Test non-compliant pool (MFA OFF)
    const nonCompliant = await corsair.recon(fixtureNonCompliant);
    expect(nonCompliant.snapshot.mfaConfiguration).toBe("OFF");
    expect(nonCompliant.snapshot.softwareTokenMfaEnabled).toBe(false);
  });

  test("RECON captures password policy details", async () => {
    const result = await corsair.recon(fixtureCompliant);

    expect(result.snapshot.passwordPolicy).toEqual({
      minimumLength: 14,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSymbols: true,
      temporaryPasswordValidityDays: 1
    });
  });

  test("RECON captures risk configuration presence", async () => {
    const compliant = await corsair.recon(fixtureCompliant);
    expect(compliant.snapshot.riskConfiguration).toBeDefined();
    expect(compliant.snapshot.riskConfiguration?.compromisedCredentialsAction).toBe("BLOCK");
    expect(compliant.snapshot.riskConfiguration?.accountTakeoverHighAction).toBe("BLOCK");

    const nonCompliant = await corsair.recon(fixtureNonCompliant);
    expect(nonCompliant.snapshot.riskConfiguration).toBeNull();
  });

  test("RECON is idempotent - multiple calls return same data", async () => {
    const first = await corsair.recon(fixtureCompliant);
    const second = await corsair.recon(fixtureCompliant);

    // Snapshots should be equivalent (except timestamp)
    expect(first.snapshot.userPoolId).toBe(second.snapshot.userPoolId);
    expect(first.snapshot.mfaConfiguration).toBe(second.snapshot.mfaConfiguration);
    expect(first.snapshot.passwordPolicy).toEqual(second.snapshot.passwordPolicy);
  });

  test("RECON tracks observation metadata", async () => {
    const result = await corsair.recon(fixtureCompliant);

    expect(result.metadata).toBeDefined();
    expect(result.metadata.source).toBe("fixture");
    expect(result.metadata.readonly).toBe(true);
    expect(result.metadata.durationMs).toBeGreaterThanOrEqual(0);
  });
});
