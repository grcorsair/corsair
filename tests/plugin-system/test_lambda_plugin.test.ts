/**
 * AWS Lambda Plugin Tests
 *
 * Validates Lambda plugin manifest, type guards, factory functions,
 * fixture snapshots, and integration with Mark engine and STRIDE analysis.
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { Corsair, StrideEngine } from "../../src/corsair-mvp";
import {
  isLambdaSnapshot,
  createLambdaSnapshot,
  compliantLambdaSnapshot,
  nonCompliantLambdaSnapshot,
  LAMBDA_PROVIDER_ID,
} from "../../plugins/aws-lambda/aws-lambda-plugin";
import {
  compliantLambdaSnapshot as fixtureCompliantLambda,
  nonCompliantLambdaSnapshot as fixtureNonCompliantLambda,
  createMockLambdaSnapshot,
} from "../fixtures/mock-snapshots";

// =============================================================================
// PLUGIN MANIFEST
// =============================================================================

describe("AWS Lambda Plugin - Manifest", () => {
  let corsair: Corsair;

  beforeAll(async () => {
    corsair = new Corsair();
    await corsair.initialize();
  });

  test("Lambda plugin manifest has providerId aws-lambda", () => {
    const plugin = corsair.getPlugin("aws-lambda");
    expect(plugin).toBeDefined();
    expect(plugin!.manifest.providerId).toBe("aws-lambda");
  });

  test("Lambda plugin has >= 4 attack vectors", () => {
    const plugin = corsair.getPlugin("aws-lambda");
    expect(plugin!.manifest.attackVectors.length).toBeGreaterThanOrEqual(4);
  });

  test("attack vectors include required IDs", () => {
    const plugin = corsair.getPlugin("aws-lambda");
    const vectorIds = plugin!.manifest.attackVectors.map((v) => v.id);
    expect(vectorIds).toContain("cold-start-injection");
    expect(vectorIds).toContain("layer-tampering");
    expect(vectorIds).toContain("env-var-secrets");
    expect(vectorIds).toContain("timeout-abuse");
  });

  test("plugin discovery finds aws-lambda", () => {
    expect(corsair.hasPlugin("aws-lambda")).toBe(true);
  });
});

// =============================================================================
// TYPE GUARDS
// =============================================================================

describe("AWS Lambda Plugin - Type Guards", () => {
  test("isLambdaSnapshot validates compliant snapshot", () => {
    expect(isLambdaSnapshot(compliantLambdaSnapshot)).toBe(true);
  });

  test("isLambdaSnapshot validates non-compliant snapshot", () => {
    expect(isLambdaSnapshot(nonCompliantLambdaSnapshot)).toBe(true);
  });

  test("isLambdaSnapshot rejects null", () => {
    expect(isLambdaSnapshot(null)).toBe(false);
  });

  test("isLambdaSnapshot rejects empty object", () => {
    expect(isLambdaSnapshot({})).toBe(false);
  });

  test("isLambdaSnapshot rejects missing required fields", () => {
    expect(isLambdaSnapshot({ functionName: "test" })).toBe(false);
  });
});

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

describe("AWS Lambda Plugin - Factory Functions", () => {
  test("createLambdaSnapshot with defaults creates valid snapshot", () => {
    const snapshot = createLambdaSnapshot({ functionName: "my-function" });
    expect(isLambdaSnapshot(snapshot)).toBe(true);
    expect(snapshot.functionName).toBe("my-function");
    expect(snapshot.runtime).toBe("nodejs20.x");
    expect(snapshot.memorySize).toBe(128);
    expect(snapshot.timeout).toBe(30);
    expect(snapshot.environmentVariablesEncrypted).toBe(false);
    expect(snapshot.vpcConfigured).toBe(false);
    expect(snapshot.layerIntegrityVerified).toBe(false);
    expect(snapshot.codeSigningEnabled).toBe(false);
  });

  test("createLambdaSnapshot applies overrides", () => {
    const snapshot = createLambdaSnapshot({
      functionName: "secure-function",
      runtime: "python3.12",
      memorySize: 512,
      timeout: 60,
      environmentVariablesEncrypted: true,
      vpcConfigured: true,
      layerIntegrityVerified: true,
      codeSigningEnabled: true,
      reservedConcurrency: 100,
      deadLetterQueueConfigured: true,
      tracingEnabled: true,
    });

    expect(snapshot.runtime).toBe("python3.12");
    expect(snapshot.memorySize).toBe(512);
    expect(snapshot.timeout).toBe(60);
    expect(snapshot.environmentVariablesEncrypted).toBe(true);
    expect(snapshot.vpcConfigured).toBe(true);
    expect(snapshot.layerIntegrityVerified).toBe(true);
    expect(snapshot.codeSigningEnabled).toBe(true);
    expect(snapshot.reservedConcurrency).toBe(100);
    expect(snapshot.deadLetterQueueConfigured).toBe(true);
    expect(snapshot.tracingEnabled).toBe(true);
  });
});

// =============================================================================
// FIXTURE SNAPSHOTS
// =============================================================================

describe("AWS Lambda Plugin - Fixture Snapshots", () => {
  test("compliant Lambda snapshot has encrypted env vars, VPC, verified layers", () => {
    expect(compliantLambdaSnapshot.environmentVariablesEncrypted).toBe(true);
    expect(compliantLambdaSnapshot.vpcConfigured).toBe(true);
    expect(compliantLambdaSnapshot.layerIntegrityVerified).toBe(true);
    expect(compliantLambdaSnapshot.codeSigningEnabled).toBe(true);
    expect(compliantLambdaSnapshot.tracingEnabled).toBe(true);
  });

  test("non-compliant Lambda snapshot has unencrypted env vars, no VPC, unverified layers", () => {
    expect(nonCompliantLambdaSnapshot.environmentVariablesEncrypted).toBe(false);
    expect(nonCompliantLambdaSnapshot.vpcConfigured).toBe(false);
    expect(nonCompliantLambdaSnapshot.layerIntegrityVerified).toBe(false);
    expect(nonCompliantLambdaSnapshot.codeSigningEnabled).toBe(false);
    expect(nonCompliantLambdaSnapshot.tracingEnabled).toBe(false);
  });

  test("mock fixture snapshots re-export correctly", () => {
    expect(isLambdaSnapshot(fixtureCompliantLambda)).toBe(true);
    expect(isLambdaSnapshot(fixtureNonCompliantLambda)).toBe(true);
  });

  test("createMockLambdaSnapshot creates valid snapshot", () => {
    const snapshot = createMockLambdaSnapshot();
    expect(isLambdaSnapshot(snapshot)).toBe(true);
  });
});

// =============================================================================
// MARK ENGINE INTEGRATION
// =============================================================================

describe("AWS Lambda Plugin - Mark Engine Integration", () => {
  let corsair: Corsair;

  beforeAll(async () => {
    corsair = new Corsair();
    await corsair.initialize();
  });

  test("MARK detects drift on non-compliant Lambda snapshot (>= 3 findings)", async () => {
    const result = await corsair.mark(
      nonCompliantLambdaSnapshot as unknown as Record<string, unknown>,
      [
        { field: "environmentVariablesEncrypted", operator: "eq", value: true },
        { field: "vpcConfigured", operator: "eq", value: true },
        { field: "layerIntegrityVerified", operator: "eq", value: true },
        { field: "codeSigningEnabled", operator: "eq", value: true },
      ]
    );

    expect(result.driftDetected).toBe(true);
    const driftFindings = result.findings.filter((f) => f.drift);
    expect(driftFindings.length).toBeGreaterThanOrEqual(3);
  });
});

// =============================================================================
// STRIDE INTEGRATION
// =============================================================================

describe("AWS Lambda Plugin - STRIDE Integration", () => {
  test("STRIDE rules exist for aws-lambda provider (>= 3 threats)", () => {
    const engine = new StrideEngine();
    const result = engine.strideAnalyze(
      nonCompliantLambdaSnapshot as unknown as Record<string, unknown>,
      "aws-lambda"
    );

    expect(result.threats.length).toBeGreaterThanOrEqual(3);
    expect(result.provider).toBe("aws-lambda");
    expect(result.methodology).toBe("STRIDE-automated");
  });
});
