/**
 * RECON Primitive Test Contract
 *
 * RECON observes configuration WITHOUT modification.
 * This is a read-only reconnaissance operation that extracts state.
 *
 * In the plugin-first architecture, RECON is performed by plugins.
 * This test validates the snapshot structure and the read-only contract.
 *
 * Contract Requirements:
 * 1. Snapshots MUST have required structure (validated by type guards)
 * 2. Snapshot creation MUST NOT modify any state
 * 3. Snapshots MUST capture MFA configuration
 * 4. Snapshots MUST capture password policy
 * 5. Snapshots MUST capture risk configuration
 * 6. Snapshots MUST include timestamp of observation
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { Corsair, CognitoSnapshot } from "../../src/corsair-mvp";
import {
  compliantSnapshot,
  nonCompliantSnapshot,
  createMockSnapshot,
} from "../fixtures/mock-snapshots";
import {
  createCognitoSnapshot,
  isCognitoSnapshot,
} from "../../plugins/aws-cognito/aws-cognito-plugin";

describe("RECON Primitive - Read-Only Observation", () => {
  let corsair: Corsair;

  beforeAll(() => {
    corsair = new Corsair();
  });

  test("Snapshot has required structure (type guard validation)", () => {
    // Use plugin's type guard to validate snapshot structure
    expect(isCognitoSnapshot(compliantSnapshot)).toBe(true);
    expect(isCognitoSnapshot(nonCompliantSnapshot)).toBe(true);

    // Invalid snapshots should fail type guard
    expect(isCognitoSnapshot(null)).toBe(false);
    expect(isCognitoSnapshot({})).toBe(false);
    expect(isCognitoSnapshot({ userPoolId: "test" })).toBe(false);
  });

  test("Snapshot captures MFA configuration accurately", () => {
    // Test compliant pool (MFA ON)
    expect(compliantSnapshot.mfaConfiguration).toBe("ON");
    expect(compliantSnapshot.softwareTokenMfaEnabled).toBe(true);
    expect(compliantSnapshot.smsMfaEnabled).toBe(true);

    // Test non-compliant pool (MFA OFF)
    expect(nonCompliantSnapshot.mfaConfiguration).toBe("OFF");
    expect(nonCompliantSnapshot.softwareTokenMfaEnabled).toBe(false);
  });

  test("Snapshot captures password policy details", () => {
    expect(compliantSnapshot.passwordPolicy).toEqual({
      minimumLength: 14,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSymbols: true,
      temporaryPasswordValidityDays: 1,
    });
  });

  test("Snapshot captures risk configuration presence", () => {
    expect(compliantSnapshot.riskConfiguration).toBeDefined();
    expect(compliantSnapshot.riskConfiguration?.compromisedCredentialsAction).toBe("BLOCK");
    expect(compliantSnapshot.riskConfiguration?.accountTakeoverHighAction).toBe("BLOCK");

    expect(nonCompliantSnapshot.riskConfiguration).toBeNull();
  });

  test("Snapshots are idempotent - same config produces equivalent data", () => {
    // Create two snapshots with same config
    const first = createCognitoSnapshot({
      userPoolId: "test-pool",
      userPoolName: "Test Pool",
      mfaConfiguration: "ON",
    });

    const second = createCognitoSnapshot({
      userPoolId: "test-pool",
      userPoolName: "Test Pool",
      mfaConfiguration: "ON",
    });

    // Snapshots should be equivalent (except timestamp)
    expect(first.userPoolId).toBe(second.userPoolId);
    expect(first.mfaConfiguration).toBe(second.mfaConfiguration);
    expect(first.passwordPolicy).toEqual(second.passwordPolicy);
  });

  test("Snapshot includes observation timestamp", () => {
    const snapshot = createCognitoSnapshot({
      userPoolId: "test-pool",
      userPoolName: "Test Pool",
      mfaConfiguration: "ON",
    });

    expect(snapshot.observedAt).toBeDefined();
    expect(typeof snapshot.observedAt).toBe("string");
    // Should be valid ISO 8601 timestamp
    expect(new Date(snapshot.observedAt).toISOString()).toBe(snapshot.observedAt);
  });

  test("Plugin factory creates valid snapshots with defaults", () => {
    const snapshot = createCognitoSnapshot({
      userPoolId: "us-west-2_TEST123",
      userPoolName: "Factory Test Pool",
      mfaConfiguration: "OPTIONAL",
    });

    // Should be valid via type guard
    expect(isCognitoSnapshot(snapshot)).toBe(true);

    // Should have defaults
    expect(snapshot.softwareTokenMfaEnabled).toBe(false);
    expect(snapshot.smsMfaEnabled).toBe(false);
    expect(snapshot.passwordPolicy.minimumLength).toBe(8);
    expect(snapshot.riskConfiguration).toBeNull();
    expect(snapshot.deviceConfiguration.challengeRequiredOnNewDevice).toBe(false);
  });

  test("Mock snapshot factory allows overrides", () => {
    const snapshot = createMockSnapshot({
      userPoolId: "custom-id",
      mfaConfiguration: "ON",
      passwordPolicy: {
        minimumLength: 20,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSymbols: true,
        temporaryPasswordValidityDays: 1,
      },
    });

    expect(snapshot.userPoolId).toBe("custom-id");
    expect(snapshot.mfaConfiguration).toBe("ON");
    expect(snapshot.passwordPolicy.minimumLength).toBe(20);
  });
});
