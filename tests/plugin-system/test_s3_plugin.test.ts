/**
 * AWS S3 Plugin Tests
 *
 * Validates S3 plugin manifest, type guards, factory functions,
 * and integration with Mark/Raid engines via widened signatures.
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { Corsair } from "../../src/corsair-mvp";
import type { S3Snapshot } from "../../src/corsair-mvp";
import {
  compliantS3Snapshot,
  nonCompliantS3Snapshot,
  partialS3Snapshot,
  createMockS3Snapshot,
} from "../fixtures/mock-snapshots";
import {
  isS3Snapshot,
  createS3Snapshot,
  S3_PROVIDER_ID,
} from "../../plugins/aws-s3/aws-s3-plugin";

describe("AWS S3 Plugin - Type Guards", () => {
  test("isS3Snapshot validates compliant snapshot", () => {
    expect(isS3Snapshot(compliantS3Snapshot)).toBe(true);
  });

  test("isS3Snapshot validates non-compliant snapshot", () => {
    expect(isS3Snapshot(nonCompliantS3Snapshot)).toBe(true);
  });

  test("isS3Snapshot rejects null", () => {
    expect(isS3Snapshot(null)).toBe(false);
  });

  test("isS3Snapshot rejects empty object", () => {
    expect(isS3Snapshot({})).toBe(false);
  });

  test("isS3Snapshot rejects invalid encryption value", () => {
    expect(isS3Snapshot({ ...compliantS3Snapshot, encryption: "invalid" })).toBe(false);
  });

  test("isS3Snapshot rejects invalid versioning value", () => {
    expect(isS3Snapshot({ ...compliantS3Snapshot, versioning: "Invalid" })).toBe(false);
  });
});

describe("AWS S3 Plugin - Factory Functions", () => {
  test("createS3Snapshot creates valid snapshot with defaults", () => {
    const snapshot = createS3Snapshot({ bucketName: "test-bucket" });
    expect(isS3Snapshot(snapshot)).toBe(true);
    expect(snapshot.bucketName).toBe("test-bucket");
    expect(snapshot.publicAccessBlock).toBe(false);
    expect(snapshot.encryption).toBeNull();
    expect(snapshot.versioning).toBe("Disabled");
    expect(snapshot.logging).toBe(false);
  });

  test("createS3Snapshot applies overrides", () => {
    const snapshot = createS3Snapshot({
      bucketName: "secure-bucket",
      publicAccessBlock: true,
      encryption: "aws:kms",
      versioning: "Enabled",
      logging: true,
    });
    expect(snapshot.publicAccessBlock).toBe(true);
    expect(snapshot.encryption).toBe("aws:kms");
    expect(snapshot.versioning).toBe("Enabled");
    expect(snapshot.logging).toBe(true);
  });

  test("createMockS3Snapshot creates valid snapshot", () => {
    const snapshot = createMockS3Snapshot();
    expect(isS3Snapshot(snapshot)).toBe(true);
    expect(snapshot.bucketName).toMatch(/^test-bucket-/);
  });

  test("createMockS3Snapshot applies overrides", () => {
    const snapshot = createMockS3Snapshot({ encryption: "AES256" });
    expect(snapshot.encryption).toBe("AES256");
  });
});

describe("AWS S3 Plugin - Plugin Identity", () => {
  test("S3 provider ID is correct", () => {
    expect(S3_PROVIDER_ID).toBe("aws-s3");
  });
});

describe("AWS S3 Plugin - Mark Engine Integration", () => {
  let corsair: Corsair;

  beforeAll(async () => {
    corsair = new Corsair();
    await corsair.initialize();
  });

  test("mark detects drift on non-compliant S3 snapshot", async () => {
    const result = await corsair.mark(nonCompliantS3Snapshot as unknown as Record<string, unknown>, [
      { field: "publicAccessBlock", operator: "eq", value: true },
      { field: "encryption", operator: "eq", value: "AES256" },
      { field: "versioning", operator: "eq", value: "Enabled" },
      { field: "logging", operator: "eq", value: true },
    ]);

    expect(result.driftDetected).toBe(true);
    expect(result.findings.length).toBe(4);
    expect(result.findings.every(f => f.drift)).toBe(true);
  });

  test("mark finds no drift on compliant S3 snapshot", async () => {
    const result = await corsair.mark(compliantS3Snapshot as unknown as Record<string, unknown>, [
      { field: "publicAccessBlock", operator: "eq", value: true },
      { field: "encryption", operator: "eq", value: "AES256" },
      { field: "versioning", operator: "eq", value: "Enabled" },
      { field: "logging", operator: "eq", value: true },
    ]);

    expect(result.driftDetected).toBe(false);
    expect(result.findings.every(f => !f.drift)).toBe(true);
  });

  test("mark detects partial drift on partially compliant S3", async () => {
    const result = await corsair.mark(partialS3Snapshot as unknown as Record<string, unknown>, [
      { field: "publicAccessBlock", operator: "eq", value: true },
      { field: "encryption", operator: "eq", value: "AES256" },
      { field: "versioning", operator: "eq", value: "Enabled" },
    ]);

    expect(result.driftDetected).toBe(true);
    // publicAccessBlock is true (no drift), encryption is null (drift), versioning is Disabled (drift)
    const drifts = result.findings.filter(f => f.drift);
    expect(drifts.length).toBe(2);
  });
});

describe("AWS S3 Plugin - Raid Engine Integration", () => {
  let corsair: Corsair;

  beforeAll(async () => {
    corsair = new Corsair();
    await corsair.initialize();
  });

  test("raid executes public-access-test on non-compliant S3", async () => {
    const result = await corsair.raid(nonCompliantS3Snapshot as unknown as Record<string, unknown>, {
      vector: "public-access-test",
      intensity: 8,
      dryRun: true,
    });

    expect(result.raidId).toMatch(/^RAID-/);
    expect(result.success).toBe(true); // Attack succeeds because bucket is exposed
    expect(result.target).toBe("legacy-dev-bucket");
    expect(result.findings.some(f => f.includes("Public access block is disabled"))).toBe(true);
  });

  test("raid fails public-access-test on compliant S3", async () => {
    const result = await corsair.raid(compliantS3Snapshot as unknown as Record<string, unknown>, {
      vector: "public-access-test",
      intensity: 8,
      dryRun: true,
    });

    expect(result.success).toBe(false); // Attack fails — bucket is protected
    expect(result.controlsHeld).toBe(true);
  });

  test("raid executes encryption-test on unencrypted S3", async () => {
    const result = await corsair.raid(nonCompliantS3Snapshot as unknown as Record<string, unknown>, {
      vector: "encryption-test",
      intensity: 8,
      dryRun: true,
    });

    expect(result.success).toBe(true);
    expect(result.findings.some(f => f.includes("No encryption"))).toBe(true);
  });

  test("raid executes versioning-test on S3 without versioning", async () => {
    const result = await corsair.raid(nonCompliantS3Snapshot as unknown as Record<string, unknown>, {
      vector: "versioning-test",
      intensity: 8,
      dryRun: true,
    });

    expect(result.success).toBe(true);
    expect(result.findings.some(f => f.includes("Versioning is disabled"))).toBe(true);
  });

  test("raid versioning-test fails at low intensity", async () => {
    const result = await corsair.raid(nonCompliantS3Snapshot as unknown as Record<string, unknown>, {
      vector: "versioning-test",
      intensity: 3,
      dryRun: true,
    });

    expect(result.success).toBe(false); // Low intensity, versioning still disabled but threshold not met
  });
});
