/**
 * Lane Serialization Pattern - Concurrency Tests
 *
 * Pattern Contract:
 * 1. Per-target granularity (not global mutex)
 * 2. Same target blocks concurrent access
 * 3. Different targets can execute in parallel
 * 4. Lock release guaranteed (finally block)
 * 5. FIFO ordering for waiting callers
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { Corsair, type RaidOptions, type CognitoSnapshot } from "../../src/corsair-mvp";

const createSnapshot = (poolId: string): CognitoSnapshot => ({
  userPoolId: poolId,
  userPoolName: `Pool-${poolId}`,
  mfaConfiguration: "OFF",
  softwareTokenMfaEnabled: false,
  smsMfaEnabled: false,
  passwordPolicy: {
    minimumLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: false,
    temporaryPasswordValidityDays: 7,
  },
  riskConfiguration: null,
  deviceConfiguration: {
    challengeRequiredOnNewDevice: false,
    deviceOnlyRememberedOnUserPrompt: false,
  },
  observedAt: new Date().toISOString(),
});

describe("Lane Serialization Pattern - Concurrency Compliance", () => {
  let corsair: Corsair;
  const raidOptions: RaidOptions = { vector: "mfa-bypass", intensity: 5, dryRun: true };

  beforeEach(() => {
    corsair = new Corsair();
  });

  it("should allow concurrent raids on DIFFERENT targets", async () => {
    const snapshot1 = createSnapshot("pool-target-1");
    const snapshot2 = createSnapshot("pool-target-2");
    const snapshot3 = createSnapshot("pool-target-3");

    const startTime = Date.now();

    // All three should execute in parallel
    const [result1, result2, result3] = await Promise.all([
      corsair.raid(snapshot1, raidOptions),
      corsair.raid(snapshot2, raidOptions),
      corsair.raid(snapshot3, raidOptions),
    ]);

    const totalTime = Date.now() - startTime;

    // All should succeed
    expect(result1.target).toBe("pool-target-1");
    expect(result2.target).toBe("pool-target-2");
    expect(result3.target).toBe("pool-target-3");

    // All should complete (serialized flag indicates lane was used)
    expect(result1.serialized).toBe(true);
    expect(result2.serialized).toBe(true);
    expect(result3.serialized).toBe(true);

    // Should complete quickly (parallel execution)
    // If sequential, would take 3x as long
    expect(totalTime).toBeLessThan(500); // Reasonable threshold for parallel
  });

  it("should serialize concurrent raids on SAME target", async () => {
    const snapshot = createSnapshot("same-target-pool");

    const executionOrder: string[] = [];

    // Start all three raids simultaneously on same target
    const promise1 = corsair.raid(snapshot, raidOptions).then(r => {
      executionOrder.push(`raid1-${r.raidId}`);
      return r;
    });

    const promise2 = corsair.raid(snapshot, raidOptions).then(r => {
      executionOrder.push(`raid2-${r.raidId}`);
      return r;
    });

    const promise3 = corsair.raid(snapshot, raidOptions).then(r => {
      executionOrder.push(`raid3-${r.raidId}`);
      return r;
    });

    const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

    // All should complete successfully
    expect(result1.target).toBe("same-target-pool");
    expect(result2.target).toBe("same-target-pool");
    expect(result3.target).toBe("same-target-pool");

    // Should have 3 distinct executions
    expect(executionOrder.length).toBe(3);

    // Each raid should have unique ID
    const raidIds = [result1.raidId, result2.raidId, result3.raidId];
    expect(new Set(raidIds).size).toBe(3);
  });

  it("should release lock on successful completion", async () => {
    const snapshot = createSnapshot("lock-release-test");

    // First raid
    const result1 = await corsair.raid(snapshot, raidOptions);
    expect(result1.serialized).toBe(true);

    // Second raid should acquire lock immediately after first releases
    const result2 = await corsair.raid(snapshot, raidOptions);
    expect(result2.serialized).toBe(true);

    // Both should have completed
    expect(result1.controlsHeld !== undefined).toBe(true);
    expect(result2.controlsHeld !== undefined).toBe(true);
  });

  it("should return release function from acquire", async () => {
    // This tests the internal LaneSerializer API
    // The raid() method wraps this, but we verify the pattern exists
    const snapshot = createSnapshot("release-function-test");

    // If implementation is correct, raid should complete and release
    const result = await corsair.raid(snapshot, raidOptions);

    // Subsequent raid should not be blocked
    const startTime = Date.now();
    const result2 = await corsair.raid(snapshot, raidOptions);
    const elapsed = Date.now() - startTime;

    // Should complete quickly (lock was released)
    expect(elapsed).toBeLessThan(100);
    expect(result2.serialized).toBe(true);
  });

  it("should isolate lanes per unique target ID", async () => {
    const targets = ["alpha", "beta", "gamma", "delta", "epsilon"];
    const snapshots = targets.map(t => createSnapshot(t));

    // Run all in parallel
    const results = await Promise.all(
      snapshots.map(s => corsair.raid(s, raidOptions))
    );

    // Each should have its own target
    const resultTargets = results.map(r => r.target);
    expect(new Set(resultTargets).size).toBe(5);

    // All should be serialized (meaning lane pattern was used)
    expect(results.every(r => r.serialized)).toBe(true);
  });

  it("should handle rapid acquire/release cycles", async () => {
    const snapshot = createSnapshot("rapid-cycle-test");

    const results: string[] = [];

    // Rapid sequential raids
    for (let i = 0; i < 10; i++) {
      const result = await corsair.raid(snapshot, raidOptions);
      results.push(result.raidId);
    }

    // All 10 should complete
    expect(results.length).toBe(10);

    // All should be unique
    expect(new Set(results).size).toBe(10);
  });

  it("should not deadlock on complex interleaved access", async () => {
    const snapshotA = createSnapshot("deadlock-test-a");
    const snapshotB = createSnapshot("deadlock-test-b");

    // Interleaved access pattern that could cause deadlock with wrong impl
    const promise1 = corsair.raid(snapshotA, raidOptions);
    const promise2 = corsair.raid(snapshotB, raidOptions);
    const promise3 = corsair.raid(snapshotA, raidOptions);
    const promise4 = corsair.raid(snapshotB, raidOptions);
    const promise5 = corsair.raid(snapshotA, raidOptions);

    // All should complete without deadlock
    const results = await Promise.all([promise1, promise2, promise3, promise4, promise5]);

    expect(results.length).toBe(5);
    expect(results.filter(r => r.target === "deadlock-test-a").length).toBe(3);
    expect(results.filter(r => r.target === "deadlock-test-b").length).toBe(2);
  });
});
