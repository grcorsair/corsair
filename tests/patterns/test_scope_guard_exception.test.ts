/**
 * Scope Guard Pattern - Exception Safety Tests
 *
 * Pattern Contract:
 * 1. Cleanup executes on normal completion
 * 2. Cleanup executes on exception/error
 * 3. Cleanup in reverse registration order (LIFO)
 * 4. One cleanup failure doesn't skip others
 * 5. Guard state captured at creation time
 * 6. Double-release is safe (idempotent)
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { Corsair, type CognitoSnapshot } from "../../src/corsair-mvp";

const mockSnapshot: CognitoSnapshot = {
  userPoolId: "us-east-1_GuardTest",
  userPoolName: "GuardTestPool",
  mfaConfiguration: "ON",
  softwareTokenMfaEnabled: true,
  smsMfaEnabled: false,
  passwordPolicy: {
    minimumLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: true,
    temporaryPasswordValidityDays: 7,
  },
  riskConfiguration: {
    compromisedCredentialsAction: "BLOCK",
    accountTakeoverLowAction: "NO_ACTION",
    accountTakeoverMediumAction: "MFA_IF_CONFIGURED",
    accountTakeoverHighAction: "BLOCK",
  },
  deviceConfiguration: {
    challengeRequiredOnNewDevice: true,
    deviceOnlyRememberedOnUserPrompt: true,
  },
  observedAt: new Date().toISOString(),
};

describe("Scope Guard Pattern - Exception Safety Compliance", () => {
  let corsair: Corsair;

  beforeEach(() => {
    corsair = new Corsair();
  });

  it("should execute cleanup on normal completion", async () => {
    const result = await corsair.withEscapeGuard(mockSnapshot, async (guard) => {
      // Normal operation
      expect(guard.active).toBe(true);
      return "success";
    });

    expect(result.value).toBe("success");
    expect(result.report.success).toBe(true);

    // Guard should be released after completion
    const status = corsair.getLastGuardStatus();
    expect(status.released).toBe(true);
    expect(status.releasedOnError).toBe(false);
  });

  it("should execute cleanup on exception", async () => {
    let cleanupExecuted = false;

    try {
      await corsair.withEscapeGuard(mockSnapshot, async (guard) => {
        expect(guard.active).toBe(true);
        throw new Error("Simulated failure");
      });
    } catch (error: unknown) {
      cleanupExecuted = true;
      expect((error as Error).message).toBe("Simulated failure");
    }

    expect(cleanupExecuted).toBe(true);

    // Even on error, guard should be released
    const status = corsair.getLastGuardStatus();
    expect(status.released).toBe(true);
    expect(status.releasedOnError).toBe(true);
  });

  it("should capture initial state at guard creation", async () => {
    const result = await corsair.withEscapeGuard(mockSnapshot, async (guard) => {
      // Initial state should be captured
      expect(guard.initialState.mfaConfiguration).toBe("ON");
      expect(guard.initialState.userPoolId).toBe("us-east-1_GuardTest");
      return guard.initialState;
    });

    // Verification should show state comparison
    expect(result.verification.stateRestored).toBe(true);
    expect(result.verification.initialHash).toBeDefined();
    expect(result.verification.finalHash).toBeDefined();
  });

  it("should track guard active status correctly", async () => {
    let guardDuringExecution: boolean | undefined;

    await corsair.withEscapeGuard(mockSnapshot, async (guard) => {
      guardDuringExecution = guard.active;
      return "done";
    });

    // Guard should be active DURING execution
    expect(guardDuringExecution).toBe(true);

    // Guard should be inactive AFTER execution
    const status = corsair.getLastGuardStatus();
    expect(status.released).toBe(true);
  });

  it("should include verification hashes in result", async () => {
    const result = await corsair.withEscapeGuard(mockSnapshot, async (guard) => {
      return "verified";
    });

    // Should have cryptographic verification
    expect(result.verification.initialHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.verification.finalHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should include duration tracking", async () => {
    const startTime = Date.now();

    const result = await corsair.withEscapeGuard(mockSnapshot, async (guard) => {
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 10));
      return "timed";
    });

    expect(result.durationMs).toBeGreaterThanOrEqual(10);
    expect(result.durationMs).toBeLessThan(1000); // Sanity check
  });

  it("should include cleanup report", async () => {
    const result = await corsair.withEscapeGuard(mockSnapshot, async (guard) => {
      return "reported";
    });

    expect(result.report.guardId).toBeDefined();
    expect(result.report.success).toBe(true);
    expect(result.report.cleanupActions).toContain("state_restored");
  });

  it("should track state transitions via logStateTransition", async () => {
    await corsair.withEscapeGuard(mockSnapshot, async (guard) => {
      // Log a transition
      corsair.logStateTransition(guard, "mfaConfiguration", "ON", "OFF");
      corsair.logStateTransition(guard, "passwordPolicy.minimumLength", 12, 8);
      return "transitioned";
    });

    const transitions = corsair.getGuardTransitions();
    expect(transitions.length).toBe(2);
    expect(transitions[0].field).toBe("mfaConfiguration");
    expect(transitions[0].from).toBe("ON");
    expect(transitions[0].to).toBe("OFF");
  });

  it("should support manual guard creation and release", async () => {
    const guard = await corsair.createGuard(mockSnapshot);
    expect(guard.active).toBe(true);
    expect(guard.initialState.mfaConfiguration).toBe("ON");

    const releaseResult = await corsair.releaseGuard(guard, mockSnapshot);
    expect(releaseResult.restored).toBe(true);
    expect(guard.active).toBe(false);
  });

  it("should support rollback to initial state", async () => {
    const guard = await corsair.createGuard(mockSnapshot);

    // Capture intermediate states
    const modifiedSnapshot = { ...mockSnapshot, mfaConfiguration: "OFF" as const };
    corsair.captureIntermediateState(guard, modifiedSnapshot);

    const rollbackResult = await corsair.rollback(guard);
    expect(rollbackResult.rolledBack).toBe(true);
    expect(rollbackResult.toState.mfaConfiguration).toBe("ON");
    expect(rollbackResult.fromState.mfaConfiguration).toBe("OFF");
  });

  it("should handle guard timeout expiration", async () => {
    const guard = await corsair.createGuard(mockSnapshot, { timeoutMs: 50 });
    expect(corsair.isGuardExpired(guard)).toBe(false);

    // Wait for timeout
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(corsair.isGuardExpired(guard)).toBe(true);
    expect(guard.active).toBe(false);
  });

  it("should use RAII-style escape for simple cleanup operations", () => {
    const cleanupOps = [
      () => ({ operation: "cleanup1", success: true }),
      () => ({ operation: "cleanup2", success: true }),
      () => ({ operation: "cleanup3", success: true }),
    ];

    const result = corsair.escape(cleanupOps);

    expect(result.cleanupOps).toBe(3);
    expect(result.allSuccessful).toBe(true);
    expect(result.stateRestored).toBe(true);
    expect(result.noLeakedResources).toBe(true);
  });

  it("should continue cleanup even if one operation fails", () => {
    const cleanupOps = [
      () => ({ operation: "cleanup1", success: true }),
      () => { throw new Error("cleanup2 failed"); },
      () => ({ operation: "cleanup3", success: true }),
    ];

    const result = corsair.escape(cleanupOps);

    expect(result.cleanupOps).toBe(3);
    expect(result.allSuccessful).toBe(false);
  });
});
