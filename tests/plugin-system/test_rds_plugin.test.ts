/**
 * AWS RDS Plugin Tests
 *
 * Validates RDS plugin manifest, type guards, factory functions,
 * fixture snapshots, and integration with Mark engine and STRIDE analysis.
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { Corsair, SpyglassEngine } from "../../src/corsair-mvp";
import {
  isRDSSnapshot,
  createRDSSnapshot,
  compliantRDSSnapshot,
  nonCompliantRDSSnapshot,
  RDS_PROVIDER_ID,
} from "../../plugins/aws-rds/aws-rds-plugin";
import {
  compliantRDSSnapshot as fixtureCompliantRDS,
  nonCompliantRDSSnapshot as fixtureNonCompliantRDS,
  createMockRDSSnapshot,
} from "../fixtures/mock-snapshots";

// =============================================================================
// PLUGIN MANIFEST
// =============================================================================

describe("AWS RDS Plugin - Manifest", () => {
  let corsair: Corsair;

  beforeAll(async () => {
    corsair = new Corsair();
    await corsair.initialize();
  });

  test("RDS plugin manifest has providerId aws-rds", () => {
    const plugin = corsair.getPlugin("aws-rds");
    expect(plugin).toBeDefined();
    expect(plugin!.manifest.providerId).toBe("aws-rds");
  });

  test("RDS plugin has >= 4 attack vectors", () => {
    const plugin = corsair.getPlugin("aws-rds");
    expect(plugin!.manifest.attackVectors.length).toBeGreaterThanOrEqual(4);
  });

  test("attack vectors include required IDs", () => {
    const plugin = corsair.getPlugin("aws-rds");
    const vectorIds = plugin!.manifest.attackVectors.map((v) => v.id);
    expect(vectorIds).toContain("public-endpoint");
    expect(vectorIds).toContain("unencrypted-storage");
    expect(vectorIds).toContain("weak-auth");
    expect(vectorIds).toContain("no-audit-logging");
  });

  test("plugin discovery finds aws-rds", () => {
    expect(corsair.hasPlugin("aws-rds")).toBe(true);
  });
});

// =============================================================================
// TYPE GUARDS
// =============================================================================

describe("AWS RDS Plugin - Type Guards", () => {
  test("isRDSSnapshot validates compliant snapshot", () => {
    expect(isRDSSnapshot(compliantRDSSnapshot)).toBe(true);
  });

  test("isRDSSnapshot validates non-compliant snapshot", () => {
    expect(isRDSSnapshot(nonCompliantRDSSnapshot)).toBe(true);
  });

  test("isRDSSnapshot rejects null", () => {
    expect(isRDSSnapshot(null)).toBe(false);
  });

  test("isRDSSnapshot rejects empty object", () => {
    expect(isRDSSnapshot({})).toBe(false);
  });

  test("isRDSSnapshot rejects missing required fields", () => {
    expect(isRDSSnapshot({ instanceId: "db-001" })).toBe(false);
  });
});

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

describe("AWS RDS Plugin - Factory Functions", () => {
  test("createRDSSnapshot with defaults creates valid snapshot", () => {
    const snapshot = createRDSSnapshot({ instanceId: "my-database" });
    expect(isRDSSnapshot(snapshot)).toBe(true);
    expect(snapshot.instanceId).toBe("my-database");
    expect(snapshot.engine).toBe("postgres");
    expect(snapshot.engineVersion).toBe("15.4");
    expect(snapshot.publiclyAccessible).toBe(false);
    expect(snapshot.storageEncrypted).toBe(false);
    expect(snapshot.iamAuthEnabled).toBe(false);
    expect(snapshot.auditLogging).toBe(false);
  });

  test("createRDSSnapshot applies overrides", () => {
    const snapshot = createRDSSnapshot({
      instanceId: "secure-db",
      engine: "mysql",
      engineVersion: "8.0.35",
      publiclyAccessible: false,
      storageEncrypted: true,
      iamAuthEnabled: true,
      auditLogging: true,
      multiAZ: true,
      backupRetentionDays: 30,
      deletionProtection: true,
      performanceInsightsEnabled: true,
    });

    expect(snapshot.engine).toBe("mysql");
    expect(snapshot.engineVersion).toBe("8.0.35");
    expect(snapshot.storageEncrypted).toBe(true);
    expect(snapshot.iamAuthEnabled).toBe(true);
    expect(snapshot.auditLogging).toBe(true);
    expect(snapshot.multiAZ).toBe(true);
    expect(snapshot.backupRetentionDays).toBe(30);
    expect(snapshot.deletionProtection).toBe(true);
    expect(snapshot.performanceInsightsEnabled).toBe(true);
  });
});

// =============================================================================
// FIXTURE SNAPSHOTS
// =============================================================================

describe("AWS RDS Plugin - Fixture Snapshots", () => {
  test("compliant RDS snapshot has encryption, IAM auth, audit logging, private endpoint", () => {
    expect(compliantRDSSnapshot.publiclyAccessible).toBe(false);
    expect(compliantRDSSnapshot.storageEncrypted).toBe(true);
    expect(compliantRDSSnapshot.iamAuthEnabled).toBe(true);
    expect(compliantRDSSnapshot.auditLogging).toBe(true);
    expect(compliantRDSSnapshot.multiAZ).toBe(true);
    expect(compliantRDSSnapshot.deletionProtection).toBe(true);
  });

  test("non-compliant RDS snapshot has public endpoint, no encryption, no IAM auth", () => {
    expect(nonCompliantRDSSnapshot.publiclyAccessible).toBe(true);
    expect(nonCompliantRDSSnapshot.storageEncrypted).toBe(false);
    expect(nonCompliantRDSSnapshot.iamAuthEnabled).toBe(false);
    expect(nonCompliantRDSSnapshot.auditLogging).toBe(false);
    expect(nonCompliantRDSSnapshot.deletionProtection).toBe(false);
  });

  test("mock fixture snapshots re-export correctly", () => {
    expect(isRDSSnapshot(fixtureCompliantRDS)).toBe(true);
    expect(isRDSSnapshot(fixtureNonCompliantRDS)).toBe(true);
  });

  test("createMockRDSSnapshot creates valid snapshot", () => {
    const snapshot = createMockRDSSnapshot();
    expect(isRDSSnapshot(snapshot)).toBe(true);
  });
});

// =============================================================================
// MARK ENGINE INTEGRATION
// =============================================================================

describe("AWS RDS Plugin - Mark Engine Integration", () => {
  let corsair: Corsair;

  beforeAll(async () => {
    corsair = new Corsair();
    await corsair.initialize();
  });

  test("MARK detects drift on non-compliant RDS snapshot (>= 3 findings)", async () => {
    const result = await corsair.mark(
      nonCompliantRDSSnapshot as unknown as Record<string, unknown>,
      [
        { field: "publiclyAccessible", operator: "eq", value: false },
        { field: "storageEncrypted", operator: "eq", value: true },
        { field: "iamAuthEnabled", operator: "eq", value: true },
        { field: "auditLogging", operator: "eq", value: true },
      ]
    );

    expect(result.driftDetected).toBe(true);
    const driftFindings = result.findings.filter((f) => f.drift);
    expect(driftFindings.length).toBeGreaterThanOrEqual(3);
  });
});

// =============================================================================
// SPYGLASS INTEGRATION
// =============================================================================

describe("AWS RDS Plugin - SPYGLASS Integration", () => {
  test("SPYGLASS rules exist for aws-rds provider (>= 3 threats)", () => {
    const engine = new SpyglassEngine();
    const result = engine.spyglassAnalyze(
      nonCompliantRDSSnapshot as unknown as Record<string, unknown>,
      "aws-rds"
    );

    expect(result.threats.length).toBeGreaterThanOrEqual(3);
    expect(result.provider).toBe("aws-rds");
    expect(result.methodology).toBe("STRIDE-automated");
  });
});
