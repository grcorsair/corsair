/**
 * SCITT Types Test Contract
 *
 * Validates Supply Chain Integrity, Transparency and Trust (SCITT) type
 * definitions for the Parley transparency log integration.
 */

import { describe, test, expect } from "bun:test";
import type {
  SCITTReceipt,
  SCITTRegistration,
  TransparencyLog,
  SCITTConfig,
  SCITTRegistry,
} from "../../src/parley/scitt-types";

describe("SCITT Types - Transparency Log Types", () => {
  test("SCITTReceipt has entryId, registrationTime, logId, proof", () => {
    const receipt: SCITTReceipt = {
      entryId: "entry-001",
      registrationTime: new Date().toISOString(),
      logId: "log-corsair-001",
      proof: "base64-encoded-cose-receipt",
    };

    expect(receipt.entryId).toBe("entry-001");
    expect(receipt.registrationTime).toBeDefined();
    expect(receipt.logId).toBe("log-corsair-001");
    expect(receipt.proof).toBe("base64-encoded-cose-receipt");
  });

  test("SCITTRegistration has entryId, registrationTime, status", () => {
    const registered: SCITTRegistration = {
      entryId: "entry-002",
      registrationTime: new Date().toISOString(),
      status: "registered",
    };

    expect(registered.entryId).toBe("entry-002");
    expect(registered.status).toBe("registered");

    const pending: SCITTRegistration = {
      entryId: "entry-003",
      registrationTime: new Date().toISOString(),
      status: "pending",
    };
    expect(pending.status).toBe("pending");

    const failed: SCITTRegistration = {
      entryId: "entry-004",
      registrationTime: new Date().toISOString(),
      status: "failed",
    };
    expect(failed.status).toBe("failed");
  });

  test("TransparencyLog has logId, operator, endpoint, supportedAlgorithms", () => {
    const log: TransparencyLog = {
      logId: "log-corsair-prod",
      operator: "Corsair GRC",
      endpoint: "https://scitt.grcorsair.com/api/v1",
      supportedAlgorithms: ["ES256", "EdDSA"],
    };

    expect(log.logId).toBe("log-corsair-prod");
    expect(log.operator).toBe("Corsair GRC");
    expect(log.endpoint).toContain("https://");
    expect(log.supportedAlgorithms).toContain("EdDSA");
    expect(log.supportedAlgorithms).toHaveLength(2);
  });

  test("SCITTConfig has logEndpoint, logId, optional registrationPolicy", () => {
    const configMinimal: SCITTConfig = {
      logEndpoint: "https://scitt.grcorsair.com",
      logId: "log-001",
    };

    expect(configMinimal.logEndpoint).toBe("https://scitt.grcorsair.com");
    expect(configMinimal.logId).toBe("log-001");
    expect(configMinimal.registrationPolicy).toBeUndefined();

    const configFull: SCITTConfig = {
      logEndpoint: "https://scitt.grcorsair.com",
      logId: "log-001",
      registrationPolicy: "open",
    };

    expect(configFull.registrationPolicy).toBe("open");
  });

  test("SCITTRegistry interface shape can be implemented", () => {
    const mockRegistry: SCITTRegistry = {
      register: async (_statement: string) => ({
        entryId: "entry-mock",
        registrationTime: new Date().toISOString(),
        status: "registered" as const,
      }),
      getReceipt: async (_entryId: string) => null,
    };

    expect(mockRegistry.register).toBeDefined();
    expect(mockRegistry.getReceipt).toBeDefined();
    expect(typeof mockRegistry.register).toBe("function");
    expect(typeof mockRegistry.getReceipt).toBe("function");
  });
});
