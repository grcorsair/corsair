/**
 * Tests for Provider Lane Serializer
 *
 * Verifies composite key serialization for surgical concurrency control.
 *
 * Key Rules:
 * - Same provider + same target = SERIALIZED (waits)
 * - Same provider + different target = PARALLEL
 * - Different providers = ALWAYS PARALLEL
 *
 * TDD Approach: Writing tests FIRST to define the contract
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { ProviderLaneSerializer, LaneKey } from "../../src/core/provider-lane-serializer";

describe("LaneKey", () => {
  it("should create composite key from provider and target", () => {
    const key: LaneKey = {
      provider: "aws-cognito",
      targetId: "us-east-1_ABC123",
      composite: "aws-cognito:us-east-1_ABC123"
    };

    expect(key.provider).toBe("aws-cognito");
    expect(key.targetId).toBe("us-east-1_ABC123");
    expect(key.composite).toBe("aws-cognito:us-east-1_ABC123");
  });

  it("should have unique composite for different combinations", () => {
    const key1: LaneKey = {
      provider: "aws-cognito",
      targetId: "target-1",
      composite: "aws-cognito:target-1"
    };

    const key2: LaneKey = {
      provider: "aws-cognito",
      targetId: "target-2",
      composite: "aws-cognito:target-2"
    };

    const key3: LaneKey = {
      provider: "okta",
      targetId: "target-1",
      composite: "okta:target-1"
    };

    expect(key1.composite).not.toBe(key2.composite);
    expect(key1.composite).not.toBe(key3.composite);
    expect(key2.composite).not.toBe(key3.composite);
  });
});

describe("ProviderLaneSerializer", () => {
  let serializer: ProviderLaneSerializer;

  beforeEach(() => {
    serializer = new ProviderLaneSerializer();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CRITERION 1: Same provider + same target = SERIALIZED
  // ═══════════════════════════════════════════════════════════════════════════

  it("should serialize same provider and target", async () => {
    const key: LaneKey = {
      provider: "aws-cognito",
      targetId: "us-east-1_ABC123",
      composite: "aws-cognito:us-east-1_ABC123"
    };

    const events: string[] = [];

    // First operation acquires lock
    const release1 = await serializer.acquire(key);
    events.push("op1-start");

    // Second operation should wait
    const op2Promise = serializer.acquire(key).then(release2 => {
      events.push("op2-start");
      return release2;
    });

    // Small delay to let op2 attempt to acquire
    await new Promise(resolve => setTimeout(resolve, 10));

    // op2 should NOT have started yet
    expect(events).toEqual(["op1-start"]);

    // Release first lock
    release1();
    events.push("op1-end");

    // Now op2 should acquire
    const release2 = await op2Promise;
    events.push("op2-acquired");

    // Verify serialization order
    expect(events).toEqual(["op1-start", "op1-end", "op2-start", "op2-acquired"]);

    release2();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CRITERION 2: Same provider + different target = PARALLEL
  // ═══════════════════════════════════════════════════════════════════════════

  it("should allow parallel operations on different targets (same provider)", async () => {
    const key1: LaneKey = {
      provider: "aws-cognito",
      targetId: "target-1",
      composite: "aws-cognito:target-1"
    };

    const key2: LaneKey = {
      provider: "aws-cognito",
      targetId: "target-2",
      composite: "aws-cognito:target-2"
    };

    const events: string[] = [];

    // Both operations should acquire immediately
    const release1 = await serializer.acquire(key1);
    events.push("op1-acquired");

    const release2 = await serializer.acquire(key2);
    events.push("op2-acquired");

    // Both should have acquired (parallel)
    expect(events).toEqual(["op1-acquired", "op2-acquired"]);

    release1();
    release2();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CRITERION 3: Different providers = ALWAYS PARALLEL
  // ═══════════════════════════════════════════════════════════════════════════

  it("should allow parallel operations on different providers", async () => {
    const key1: LaneKey = {
      provider: "aws-cognito",
      targetId: "target-1",
      composite: "aws-cognito:target-1"
    };

    const key2: LaneKey = {
      provider: "okta",
      targetId: "target-1",
      composite: "okta:target-1"
    };

    const events: string[] = [];

    // Both operations should acquire immediately (different providers)
    const release1 = await serializer.acquire(key1);
    events.push("cognito-acquired");

    const release2 = await serializer.acquire(key2);
    events.push("okta-acquired");

    // Both should have acquired (parallel)
    expect(events).toEqual(["cognito-acquired", "okta-acquired"]);

    release1();
    release2();
  });

  it("should allow parallel operations across multiple different providers", async () => {
    const keys: LaneKey[] = [
      { provider: "aws-cognito", targetId: "t1", composite: "aws-cognito:t1" },
      { provider: "okta", targetId: "t1", composite: "okta:t1" },
      { provider: "auth0", targetId: "t1", composite: "auth0:t1" }
    ];

    // All should acquire immediately (different providers)
    const releases = await Promise.all(
      keys.map(key => serializer.acquire(key))
    );

    expect(releases).toHaveLength(3);

    // Clean up
    releases.forEach(release => release());
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CRITERION 4: Lane release on error
  // ═══════════════════════════════════════════════════════════════════════════

  it("should release lane when operation throws error", async () => {
    const key: LaneKey = {
      provider: "aws-cognito",
      targetId: "us-east-1_ABC123",
      composite: "aws-cognito:us-east-1_ABC123"
    };

    const release = await serializer.acquire(key);

    // Simulate operation that throws error and releases in finally
    let errorThrown = false;
    try {
      throw new Error("Operation failed");
    } catch (error) {
      errorThrown = true;
    } finally {
      release(); // Ensure release happens
    }

    expect(errorThrown).toBe(true);

    // Next operation should acquire immediately (not blocked)
    const release2 = await serializer.acquire(key);
    expect(release2).toBeDefined();
    release2();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CRITERION 5: Diagnostic - get active lanes
  // ═══════════════════════════════════════════════════════════════════════════

  it("should track active lanes", async () => {
    const key1: LaneKey = {
      provider: "aws-cognito",
      targetId: "target-1",
      composite: "aws-cognito:target-1"
    };

    const key2: LaneKey = {
      provider: "okta",
      targetId: "target-2",
      composite: "okta:target-2"
    };

    // No active lanes initially
    expect(serializer.getActiveLanes()).toHaveLength(0);

    // Acquire two lanes
    const release1 = await serializer.acquire(key1);
    const release2 = await serializer.acquire(key2);

    // Both should be active
    const active = serializer.getActiveLanes();
    expect(active).toHaveLength(2);
    expect(active).toContain("aws-cognito:target-1");
    expect(active).toContain("okta:target-2");

    // Release one
    release1();
    expect(serializer.getActiveLanes()).toHaveLength(1);
    expect(serializer.getActiveLanes()).toContain("okta:target-2");

    // Release other
    release2();
    expect(serializer.getActiveLanes()).toHaveLength(0);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CRITERION 6: Multiple sequential operations on same lane
  // ═══════════════════════════════════════════════════════════════════════════

  it("should handle multiple sequential operations on same lane", async () => {
    const key: LaneKey = {
      provider: "aws-cognito",
      targetId: "us-east-1_ABC123",
      composite: "aws-cognito:us-east-1_ABC123"
    };

    const events: number[] = [];

    // Three operations sequentially
    for (let i = 1; i <= 3; i++) {
      const release = await serializer.acquire(key);
      events.push(i);
      release();
    }

    // All three should have completed in order
    expect(events).toEqual([1, 2, 3]);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CRITERION 7: Stress test - many concurrent operations
  // ═══════════════════════════════════════════════════════════════════════════

  it("should handle many concurrent operations correctly", async () => {
    const key: LaneKey = {
      provider: "aws-cognito",
      targetId: "stress-test",
      composite: "aws-cognito:stress-test"
    };

    const counter = { value: 0 };
    const operations = 50;

    // Launch 50 operations that increment a counter
    const promises = Array.from({ length: operations }, async () => {
      const release = await serializer.acquire(key);
      const current = counter.value;
      await new Promise(resolve => setTimeout(resolve, 1)); // Simulate work
      counter.value = current + 1;
      release();
    });

    await Promise.all(promises);

    // Counter should be exactly 50 (no race conditions)
    expect(counter.value).toBe(operations);
  });
});
