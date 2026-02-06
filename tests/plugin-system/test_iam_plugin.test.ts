/**
 * AWS IAM Plugin Tests
 *
 * Validates IAM plugin manifest, type guards, factory functions,
 * fixture snapshots, and integration with Mark engine and STRIDE analysis.
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { Corsair, StrideEngine } from "../../src/corsair-mvp";
import type { IAMSnapshot } from "../../src/corsair-mvp";
import {
  isIAMSnapshot,
  createIAMSnapshot,
  compliantIAMSnapshot,
  nonCompliantIAMSnapshot,
  IAM_PROVIDER_ID,
} from "../../plugins/aws-iam/aws-iam-plugin";
import {
  compliantIAMSnapshot as fixtureCompliantIAM,
  nonCompliantIAMSnapshot as fixtureNonCompliantIAM,
  createMockIAMSnapshot,
} from "../fixtures/mock-snapshots";

// =============================================================================
// PLUGIN MANIFEST
// =============================================================================

describe("AWS IAM Plugin - Manifest", () => {
  let corsair: Corsair;

  beforeAll(async () => {
    corsair = new Corsair();
    await corsair.initialize();
  });

  test("IAM plugin manifest has providerId aws-iam", () => {
    const plugin = corsair.getPlugin("aws-iam");
    expect(plugin).toBeDefined();
    expect(plugin!.manifest.providerId).toBe("aws-iam");
  });

  test("IAM plugin has >= 4 attack vectors", () => {
    const plugin = corsair.getPlugin("aws-iam");
    expect(plugin!.manifest.attackVectors.length).toBeGreaterThanOrEqual(4);
  });

  test("attack vectors include required IDs", () => {
    const plugin = corsair.getPlugin("aws-iam");
    const vectorIds = plugin!.manifest.attackVectors.map((v) => v.id);
    expect(vectorIds).toContain("overprivileged-role");
    expect(vectorIds).toContain("unused-credentials");
    expect(vectorIds).toContain("missing-mfa");
    expect(vectorIds).toContain("policy-escalation");
  });

  test("plugin manifest has framework mappings for drift and attack vectors", () => {
    const plugin = corsair.getPlugin("aws-iam");
    expect(plugin!.manifest.frameworkMappings).toBeDefined();
    expect(plugin!.manifest.frameworkMappings!.drift).toBeDefined();
    expect(plugin!.manifest.frameworkMappings!.attackVectors).toBeDefined();
  });

  test("plugin discovery finds aws-iam", () => {
    expect(corsair.hasPlugin("aws-iam")).toBe(true);
  });
});

// =============================================================================
// TYPE GUARDS
// =============================================================================

describe("AWS IAM Plugin - Type Guards", () => {
  test("isIAMSnapshot validates compliant snapshot", () => {
    expect(isIAMSnapshot(compliantIAMSnapshot)).toBe(true);
  });

  test("isIAMSnapshot validates non-compliant snapshot", () => {
    expect(isIAMSnapshot(nonCompliantIAMSnapshot)).toBe(true);
  });

  test("isIAMSnapshot rejects null", () => {
    expect(isIAMSnapshot(null)).toBe(false);
  });

  test("isIAMSnapshot rejects empty object", () => {
    expect(isIAMSnapshot({})).toBe(false);
  });

  test("isIAMSnapshot rejects missing required fields", () => {
    expect(isIAMSnapshot({ accountId: "123" })).toBe(false);
  });
});

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

describe("AWS IAM Plugin - Factory Functions", () => {
  test("createIAMSnapshot with defaults creates valid snapshot", () => {
    const snapshot = createIAMSnapshot({ accountId: "123456789012" });
    expect(isIAMSnapshot(snapshot)).toBe(true);
    expect(snapshot.accountId).toBe("123456789012");
    expect(snapshot.mfaEnabled).toBe(false);
    expect(snapshot.hasOverprivilegedPolicies).toBe(false);
    expect(snapshot.unusedCredentialsExist).toBe(false);
    expect(snapshot.accessKeysRotated).toBe(true);
    expect(snapshot.rootAccountMfaEnabled).toBe(false);
  });

  test("createIAMSnapshot applies overrides", () => {
    const snapshot = createIAMSnapshot({
      accountId: "999888777666",
      mfaEnabled: true,
      hasOverprivilegedPolicies: true,
      unusedCredentialsExist: true,
      accessKeysRotated: false,
      rootAccountMfaEnabled: true,
      users: 50,
      roles: 30,
      policies: 100,
    });

    expect(snapshot.mfaEnabled).toBe(true);
    expect(snapshot.hasOverprivilegedPolicies).toBe(true);
    expect(snapshot.unusedCredentialsExist).toBe(true);
    expect(snapshot.accessKeysRotated).toBe(false);
    expect(snapshot.rootAccountMfaEnabled).toBe(true);
    expect(snapshot.users).toBe(50);
    expect(snapshot.roles).toBe(30);
    expect(snapshot.policies).toBe(100);
  });
});

// =============================================================================
// FIXTURE SNAPSHOTS
// =============================================================================

describe("AWS IAM Plugin - Fixture Snapshots", () => {
  test("compliant IAM snapshot has MFA, minimal policies, no unused creds", () => {
    expect(compliantIAMSnapshot.mfaEnabled).toBe(true);
    expect(compliantIAMSnapshot.hasOverprivilegedPolicies).toBe(false);
    expect(compliantIAMSnapshot.unusedCredentialsExist).toBe(false);
    expect(compliantIAMSnapshot.accessKeysRotated).toBe(true);
    expect(compliantIAMSnapshot.rootAccountMfaEnabled).toBe(true);
  });

  test("non-compliant IAM snapshot has no MFA, overprivileged, unused creds", () => {
    expect(nonCompliantIAMSnapshot.mfaEnabled).toBe(false);
    expect(nonCompliantIAMSnapshot.hasOverprivilegedPolicies).toBe(true);
    expect(nonCompliantIAMSnapshot.unusedCredentialsExist).toBe(true);
    expect(nonCompliantIAMSnapshot.accessKeysRotated).toBe(false);
    expect(nonCompliantIAMSnapshot.rootAccountMfaEnabled).toBe(false);
  });
});

// =============================================================================
// MOCK SNAPSHOT FIXTURES
// =============================================================================

describe("AWS IAM Plugin - Mock Snapshot Fixtures", () => {
  test("createMockIAMSnapshot creates valid snapshot", () => {
    const snapshot = createMockIAMSnapshot();
    expect(isIAMSnapshot(snapshot)).toBe(true);
    expect(snapshot.accountId).toMatch(/^test-account-/);
  });

  test("createMockIAMSnapshot applies overrides", () => {
    const snapshot = createMockIAMSnapshot({ mfaEnabled: true, users: 42 });
    expect(snapshot.mfaEnabled).toBe(true);
    expect(snapshot.users).toBe(42);
  });
});

// =============================================================================
// MARK ENGINE INTEGRATION
// =============================================================================

describe("AWS IAM Plugin - Mark Engine Integration", () => {
  let corsair: Corsair;

  beforeAll(async () => {
    corsair = new Corsair();
    await corsair.initialize();
  });

  test("MARK detects drift on non-compliant IAM snapshot (>= 3 findings)", async () => {
    const result = await corsair.mark(
      nonCompliantIAMSnapshot as unknown as Record<string, unknown>,
      [
        { field: "mfaEnabled", operator: "eq", value: true },
        { field: "hasOverprivilegedPolicies", operator: "eq", value: false },
        { field: "unusedCredentialsExist", operator: "eq", value: false },
        { field: "accessKeysRotated", operator: "eq", value: true },
        { field: "rootAccountMfaEnabled", operator: "eq", value: true },
      ]
    );

    expect(result.driftDetected).toBe(true);
    const driftFindings = result.findings.filter((f) => f.drift);
    expect(driftFindings.length).toBeGreaterThanOrEqual(3);
  });

  test("MARK finds no drift on compliant IAM snapshot", async () => {
    const result = await corsair.mark(
      compliantIAMSnapshot as unknown as Record<string, unknown>,
      [
        { field: "mfaEnabled", operator: "eq", value: true },
        { field: "hasOverprivilegedPolicies", operator: "eq", value: false },
        { field: "unusedCredentialsExist", operator: "eq", value: false },
        { field: "accessKeysRotated", operator: "eq", value: true },
        { field: "rootAccountMfaEnabled", operator: "eq", value: true },
      ]
    );

    expect(result.driftDetected).toBe(false);
    expect(result.findings.every((f) => !f.drift)).toBe(true);
  });
});

// =============================================================================
// STRIDE INTEGRATION
// =============================================================================

describe("AWS IAM Plugin - STRIDE Integration", () => {
  test("STRIDE rules exist for aws-iam provider (>= 4 threats)", () => {
    const engine = new StrideEngine();
    const result = engine.strideAnalyze(
      nonCompliantIAMSnapshot as unknown as Record<string, unknown>,
      "aws-iam"
    );

    expect(result.threats.length).toBeGreaterThanOrEqual(4);
    expect(result.provider).toBe("aws-iam");
    expect(result.methodology).toBe("STRIDE-automated");
  });
});
