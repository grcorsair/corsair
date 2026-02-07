/**
 * SCITT Registry Test Contract
 *
 * Tests the MockSCITTRegistry implementation for in-memory
 * statement registration and receipt retrieval.
 */

import { describe, test, expect } from "bun:test";
import { MockSCITTRegistry } from "../../src/parley/scitt-registry";
import type { SCITTRegistry } from "../../src/parley/scitt-types";

describe("MockSCITTRegistry - In-Memory SCITT Registry", () => {
  test("implements SCITTRegistry interface", () => {
    const registry: SCITTRegistry = new MockSCITTRegistry();
    expect(registry.register).toBeDefined();
    expect(registry.getReceipt).toBeDefined();
  });

  test("register returns a registration with status registered", async () => {
    const registry = new MockSCITTRegistry();
    const result = await registry.register("test-jwt-vc-statement");

    expect(result.entryId).toBeDefined();
    expect(result.entryId.length).toBeGreaterThan(0);
    expect(result.registrationTime).toBeDefined();
    expect(result.status).toBe("registered");
  });

  test("register generates unique entry IDs", async () => {
    const registry = new MockSCITTRegistry();
    const r1 = await registry.register("statement-1");
    const r2 = await registry.register("statement-2");
    const r3 = await registry.register("statement-3");

    expect(r1.entryId).not.toBe(r2.entryId);
    expect(r2.entryId).not.toBe(r3.entryId);
    expect(r1.entryId).not.toBe(r3.entryId);
  });

  test("getReceipt returns receipt for registered entry", async () => {
    const registry = new MockSCITTRegistry();
    const registration = await registry.register("my-signed-cpoe");
    const receipt = await registry.getReceipt(registration.entryId);

    expect(receipt).not.toBeNull();
    expect(receipt!.entryId).toBe(registration.entryId);
    expect(receipt!.registrationTime).toBe(registration.registrationTime);
    expect(receipt!.logId).toBeDefined();
    expect(receipt!.proof).toBeDefined();
    expect(receipt!.proof.length).toBeGreaterThan(0);
  });

  test("getReceipt returns null for unknown entry ID", async () => {
    const registry = new MockSCITTRegistry();
    const receipt = await registry.getReceipt("nonexistent-entry-id");

    expect(receipt).toBeNull();
  });

  test("multiple registrations are independently retrievable", async () => {
    const registry = new MockSCITTRegistry();
    const r1 = await registry.register("statement-alpha");
    const r2 = await registry.register("statement-beta");

    const receipt1 = await registry.getReceipt(r1.entryId);
    const receipt2 = await registry.getReceipt(r2.entryId);

    expect(receipt1).not.toBeNull();
    expect(receipt2).not.toBeNull();
    expect(receipt1!.entryId).toBe(r1.entryId);
    expect(receipt2!.entryId).toBe(r2.entryId);
    expect(receipt1!.entryId).not.toBe(receipt2!.entryId);
  });

  test("registrationTime is a valid ISO 8601 timestamp", async () => {
    const registry = new MockSCITTRegistry();
    const before = new Date().toISOString();
    const result = await registry.register("time-test");
    const after = new Date().toISOString();

    expect(result.registrationTime >= before).toBe(true);
    expect(result.registrationTime <= after).toBe(true);
  });

  test("constructor accepts optional logId", () => {
    const registry = new MockSCITTRegistry("custom-log-id");
    expect(registry).toBeDefined();
  });

  test("receipt logId matches configured logId", async () => {
    const registry = new MockSCITTRegistry("my-test-log");
    const registration = await registry.register("statement");
    const receipt = await registry.getReceipt(registration.entryId);

    expect(receipt).not.toBeNull();
    expect(receipt!.logId).toBe("my-test-log");
  });
});
