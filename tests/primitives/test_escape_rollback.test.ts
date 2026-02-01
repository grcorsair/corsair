/**
 * ESCAPE Primitive Test Contract
 *
 * ESCAPE provides rollback state with scope guards (RAII pattern).
 * It ensures cleanup happens even on error, preventing state leakage.
 *
 * Contract Requirements:
 * 1. ESCAPE MUST capture initial state before operations
 * 2. ESCAPE MUST restore state on scope exit
 * 3. ESCAPE MUST handle errors gracefully (cleanup on throw)
 * 4. ESCAPE MUST support nested scope guards
 * 5. ESCAPE MUST log all state transitions
 * 6. ESCAPE MUST verify state restoration
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { Corsair, ScopeGuard, EscapeResult, CognitoSnapshot } from "../../src/corsair-mvp";
import {
  compliantSnapshot,
  nonCompliantSnapshot,
} from "../fixtures/mock-snapshots";

describe("ESCAPE Primitive - Rollback & Scope Guards", () => {
  let corsair: Corsair;

  beforeAll(() => {
    corsair = new Corsair();
  });

  test("ESCAPE creates scope guard with initial state", async () => {
    const guard = await corsair.createGuard(nonCompliantSnapshot);

    expect(guard).toBeDefined();
    expect(guard.guardId).toMatch(/^GUARD-/);
    expect(guard.initialState).toBeDefined();
    expect(guard.initialState.userPoolId).toBe(nonCompliantSnapshot.userPoolId);
    expect(guard.active).toBe(true);
    expect(guard.createdAt).toBeDefined();
  });

  test("ESCAPE restores state on scope exit", async () => {
    const guard = await corsair.createGuard(nonCompliantSnapshot);

    // Simulate state modification (in-memory only for testing)
    const modifiedSnapshot = { ...nonCompliantSnapshot, mfaConfiguration: "ON" as const };

    // Release guard - should restore to initial state
    const result = await corsair.releaseGuard(guard, modifiedSnapshot);

    expect(result.restored).toBe(true);
    expect(result.finalState.mfaConfiguration).toBe(nonCompliantSnapshot.mfaConfiguration);
    expect(guard.active).toBe(false);
  });

  test("ESCAPE handles errors with cleanup", async () => {
    let guardReleased = false;

    try {
      const result = await corsair.withEscapeGuard(nonCompliantSnapshot, async (guard) => {
        // Simulate some operation that throws
        throw new Error("Simulated failure");
      });
    } catch (e) {
      // Error should propagate
      expect((e as Error).message).toBe("Simulated failure");
    }

    // Guard should have been released despite error
    const lastGuardStatus = corsair.getLastGuardStatus();
    expect(lastGuardStatus.released).toBe(true);
    expect(lastGuardStatus.releasedOnError).toBe(true);
  });

  test("ESCAPE supports nested scope guards", async () => {
    const guards: string[] = [];

    await corsair.withEscapeGuard(nonCompliantSnapshot, async (outerGuard) => {
      guards.push(outerGuard.guardId);

      await corsair.withEscapeGuard(compliantSnapshot, async (innerGuard) => {
        guards.push(innerGuard.guardId);

        // Both guards should be active
        expect(outerGuard.active).toBe(true);
        expect(innerGuard.active).toBe(true);
      });

      // Inner guard should be released, outer still active
      expect(outerGuard.active).toBe(true);
    });

    // Both guards should be released now
    expect(guards.length).toBe(2);
    expect(guards[0]).not.toBe(guards[1]);
  });

  test("ESCAPE logs all state transitions", async () => {
    await corsair.withEscapeGuard(nonCompliantSnapshot, async (guard) => {
      // Simulate state changes
      corsair.logStateTransition(guard, "mfaConfiguration", "OFF", "ON");
      corsair.logStateTransition(guard, "mfaConfiguration", "ON", "OFF");
    });

    const transitions = corsair.getGuardTransitions();

    expect(transitions.length).toBeGreaterThanOrEqual(2);
    expect(transitions[0]).toHaveProperty("guardId");
    expect(transitions[0]).toHaveProperty("field");
    expect(transitions[0]).toHaveProperty("from");
    expect(transitions[0]).toHaveProperty("to");
    expect(transitions[0]).toHaveProperty("timestamp");
  });

  test("ESCAPE verifies state restoration", async () => {
    const result = await corsair.withEscapeGuard(nonCompliantSnapshot, async (guard) => {
      // Return modified state
      return { ...nonCompliantSnapshot, mfaConfiguration: "ON" as const };
    });

    // Result should include verification
    expect(result.verification).toBeDefined();
    expect(result.verification.initialHash).toBeDefined();
    expect(result.verification.finalHash).toBeDefined();
    expect(result.verification.stateRestored).toBe(true);
  });

  test("ESCAPE guard tracks duration", async () => {
    const start = Date.now();

    const result = await corsair.withEscapeGuard(nonCompliantSnapshot, async (guard) => {
      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 50));
      return nonCompliantSnapshot;
    });

    expect(result.durationMs).toBeGreaterThanOrEqual(50);
    expect(result.durationMs).toBeLessThan(1000); // Sanity check
  });

  test("ESCAPE provides rollback capability", async () => {
    const guard = await corsair.createGuard(nonCompliantSnapshot);

    // Capture some intermediate state
    const intermediateSnapshot = { ...nonCompliantSnapshot, mfaConfiguration: "ON" as const };
    corsair.captureIntermediateState(guard, intermediateSnapshot);

    // Rollback to initial
    const rollbackResult = await corsair.rollback(guard);

    expect(rollbackResult.rolledBack).toBe(true);
    expect(rollbackResult.fromState.mfaConfiguration).toBe("ON");
    expect(rollbackResult.toState.mfaConfiguration).toBe("OFF");
  });

  test("ESCAPE guard timeout expires correctly", async () => {
    // Create guard with short timeout
    const guard = await corsair.createGuard(nonCompliantSnapshot, { timeoutMs: 100 });

    // Wait for timeout
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Guard should be expired
    expect(corsair.isGuardExpired(guard)).toBe(true);
    expect(guard.active).toBe(false);
  });

  test("ESCAPE generates escape report", async () => {
    const result = await corsair.withEscapeGuard(nonCompliantSnapshot, async (guard) => {
      // Some operations
      return nonCompliantSnapshot;
    });

    const report = result.report;

    expect(report).toBeDefined();
    expect(report.guardId).toBeDefined();
    expect(report.operationsPerformed).toBeDefined();
    expect(report.stateChanges).toBeDefined();
    expect(report.cleanupActions).toBeDefined();
    expect(report.success).toBe(true);
  });
});
