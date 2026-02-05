/**
 * Azure Entra ID Plugin Tests (Skeleton)
 *
 * Validates Azure Entra plugin manifest, type guards, factory functions,
 * and fixture snapshots.
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { Corsair } from "../../src/corsair-mvp";
import {
  isEntraSnapshot,
  createEntraSnapshot,
  compliantEntraSnapshot,
  nonCompliantEntraSnapshot,
  AZURE_ENTRA_PROVIDER_ID,
} from "../../plugins/azure-entra/azure-entra-plugin";
import type { EntraSnapshot } from "../../plugins/azure-entra/azure-entra-plugin";

describe("Azure Entra Plugin - Type Guards", () => {
  test("isEntraSnapshot validates compliant snapshot", () => {
    expect(isEntraSnapshot(compliantEntraSnapshot)).toBe(true);
  });

  test("isEntraSnapshot validates non-compliant snapshot", () => {
    expect(isEntraSnapshot(nonCompliantEntraSnapshot)).toBe(true);
  });

  test("isEntraSnapshot rejects null", () => {
    expect(isEntraSnapshot(null)).toBe(false);
  });

  test("isEntraSnapshot rejects empty object", () => {
    expect(isEntraSnapshot({})).toBe(false);
  });

  test("isEntraSnapshot rejects missing tenantId", () => {
    const { tenantId, ...rest } = compliantEntraSnapshot;
    expect(isEntraSnapshot(rest)).toBe(false);
  });
});

describe("Azure Entra Plugin - Factory Functions", () => {
  test("createEntraSnapshot creates valid snapshot with defaults", () => {
    const snapshot = createEntraSnapshot({
      tenantId: "test-tenant-001",
      tenantName: "Test Corp",
    });

    expect(isEntraSnapshot(snapshot)).toBe(true);
    expect(snapshot.tenantId).toBe("test-tenant-001");
    expect(snapshot.tenantName).toBe("Test Corp");
    expect(snapshot.conditionalAccessPolicies).toEqual([]);
    expect(snapshot.passwordHashSync.enabled).toBe(true);
    expect(snapshot.passwordHashSync.smartLockoutEnabled).toBe(false);
    expect(snapshot.mfaConfiguration.perUserMfaState).toBe("disabled");
    expect(snapshot.mfaConfiguration.numberMatchingEnabled).toBe(false);
  });

  test("createEntraSnapshot applies overrides", () => {
    const snapshot = createEntraSnapshot({
      tenantId: "test-tenant-002",
      tenantName: "Secure Corp",
      mfaConfiguration: {
        perUserMfaState: "enforced",
        numberMatchingEnabled: true,
        fraudAlertEnabled: true,
      },
    });

    expect(snapshot.mfaConfiguration.perUserMfaState).toBe("enforced");
    expect(snapshot.mfaConfiguration.numberMatchingEnabled).toBe(true);
    expect(snapshot.mfaConfiguration.fraudAlertEnabled).toBe(true);
  });
});

describe("Azure Entra Plugin - Fixture Snapshots", () => {
  test("compliant snapshot has conditional access policies", () => {
    expect(compliantEntraSnapshot.conditionalAccessPolicies.length).toBeGreaterThan(0);
    expect(compliantEntraSnapshot.mfaConfiguration.perUserMfaState).toBe("enforced");
    expect(compliantEntraSnapshot.mfaConfiguration.numberMatchingEnabled).toBe(true);
    expect(compliantEntraSnapshot.passwordHashSync.smartLockoutEnabled).toBe(true);
  });

  test("non-compliant snapshot has no conditional access policies", () => {
    expect(nonCompliantEntraSnapshot.conditionalAccessPolicies.length).toBe(0);
    expect(nonCompliantEntraSnapshot.mfaConfiguration.perUserMfaState).toBe("disabled");
    expect(nonCompliantEntraSnapshot.mfaConfiguration.numberMatchingEnabled).toBe(false);
    expect(nonCompliantEntraSnapshot.passwordHashSync.smartLockoutEnabled).toBe(false);
  });
});

describe("Azure Entra Plugin - Plugin Identity", () => {
  test("Azure Entra provider ID is correct", () => {
    expect(AZURE_ENTRA_PROVIDER_ID).toBe("azure-entra");
  });
});

describe("Azure Entra Plugin - Plugin Discovery", () => {
  let corsair: Corsair;

  beforeAll(async () => {
    corsair = new Corsair();
    await corsair.initialize();
  });

  test("discovers azure-entra plugin from directory", () => {
    expect(corsair.hasPlugin("azure-entra")).toBe(true);
  });

  test("azure-entra plugin has correct manifest", () => {
    const plugin = corsair.getPlugin("azure-entra");
    expect(plugin).toBeDefined();
    expect(plugin!.manifest.providerId).toBe("azure-entra");
    expect(plugin!.manifest.providerName).toBe("Azure Entra ID");
    expect(plugin!.manifest.version).toBe("0.1.0");
    expect(plugin!.manifest.attackVectors.length).toBe(3);
  });

  test("azure-entra plugin has framework mappings", () => {
    const plugin = corsair.getPlugin("azure-entra");
    expect(plugin!.manifest.frameworkMappings).toBeDefined();
    expect(plugin!.manifest.frameworkMappings!.drift).toBeDefined();
    expect(plugin!.manifest.frameworkMappings!.attackVectors).toBeDefined();
  });

  test("azure-entra plugin attack vectors are correct", () => {
    const plugin = corsair.getPlugin("azure-entra");
    const vectorIds = plugin!.manifest.attackVectors.map(v => v.id);
    expect(vectorIds).toContain("conditional-access-bypass");
    expect(vectorIds).toContain("password-sync-exploit");
    expect(vectorIds).toContain("mfa-fatigue");
  });
});

describe("Azure Entra Plugin - Mark Engine Integration (via generic snapshot)", () => {
  let corsair: Corsair;

  beforeAll(async () => {
    corsair = new Corsair();
    await corsair.initialize();
  });

  test("mark detects drift on non-compliant Entra snapshot", async () => {
    const result = await corsair.mark(
      nonCompliantEntraSnapshot as unknown as Record<string, unknown>,
      [
        { field: "mfaConfiguration.perUserMfaState", operator: "eq", value: "enforced" },
        { field: "mfaConfiguration.numberMatchingEnabled", operator: "eq", value: true },
        { field: "passwordHashSync.smartLockoutEnabled", operator: "eq", value: true },
      ]
    );

    expect(result.driftDetected).toBe(true);
    expect(result.findings.filter(f => f.drift).length).toBe(3);
  });

  test("mark finds no drift on compliant Entra snapshot", async () => {
    const result = await corsair.mark(
      compliantEntraSnapshot as unknown as Record<string, unknown>,
      [
        { field: "mfaConfiguration.perUserMfaState", operator: "eq", value: "enforced" },
        { field: "mfaConfiguration.numberMatchingEnabled", operator: "eq", value: true },
        { field: "passwordHashSync.smartLockoutEnabled", operator: "eq", value: true },
      ]
    );

    expect(result.driftDetected).toBe(false);
  });
});
