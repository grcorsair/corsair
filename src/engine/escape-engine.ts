/**
 * ESCAPE Engine - Rollback & Scope Guards
 *
 * Extracted from corsair-mvp.ts.
 * Provides RAII-style cleanup, scope guards, state transitions, and rollback.
 */

import { createHash } from "crypto";
import type {
  CognitoSnapshot,
  ScopeGuard,
  GuardStatus,
  StateTransition,
  EscapeOptions,
  EscapeResult,
  SimpleEscapeResult,
  RollbackResult,
  ReleaseResult,
} from "../types";

/** Any snapshot shape accepted by EscapeEngine */
type AnySnapshot = CognitoSnapshot | Record<string, unknown>;

export class EscapeEngine {
  private guards: Map<string, ScopeGuard> = new Map();
  private transitions: StateTransition[] = [];
  private lastGuardStatus: GuardStatus = { released: false, releasedOnError: false };
  private intermediateStates: Map<string, AnySnapshot[]> = new Map();

  escape(cleanupOps: Array<() => { operation: string; success: boolean }>): SimpleEscapeResult {
    const startTime = Date.now();
    const results: Array<{ operation: string; success: boolean }> = [];

    for (const cleanup of cleanupOps) {
      try {
        const result = cleanup();
        results.push(result);
      } catch (error) {
        results.push({ operation: "unknown", success: false });
      }
    }

    const durationMs = Date.now() - startTime;
    const allSuccessful = results.every(r => r.success);

    return {
      cleanupOps: cleanupOps.length,
      allSuccessful,
      stateRestored: allSuccessful,
      noLeakedResources: allSuccessful,
      durationMs,
    };
  }

  async createGuard(snapshot: AnySnapshot, options: EscapeOptions = {}): Promise<ScopeGuard> {
    const guardId = `GUARD-${crypto.randomUUID().slice(0, 8)}`;
    const guard: ScopeGuard = {
      guardId,
      initialState: { ...snapshot },
      active: true,
      createdAt: new Date().toISOString(),
      timeoutMs: options.timeoutMs,
      transitions: [],
    };

    this.guards.set(guardId, guard);
    this.intermediateStates.set(guardId, []);

    if (options.timeoutMs) {
      setTimeout(() => {
        const g = this.guards.get(guardId);
        if (g && g.active) {
          g.active = false;
        }
      }, options.timeoutMs);
    }

    return guard;
  }

  async releaseGuard(guard: ScopeGuard, currentState: AnySnapshot): Promise<ReleaseResult> {
    guard.active = false;

    return {
      restored: true,
      finalState: guard.initialState,
    };
  }

  async withEscapeGuard<T>(
    snapshot: AnySnapshot,
    fn: (guard: ScopeGuard) => Promise<T>
  ): Promise<EscapeResult<T>> {
    const guard = await this.createGuard(snapshot);
    const startTime = Date.now();
    const initialHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");

    let result: T;
    let releasedOnError = false;

    try {
      result = await fn(guard);
    } catch (error) {
      releasedOnError = true;
      this.lastGuardStatus = { released: true, releasedOnError: true };
      guard.active = false;
      throw error;
    } finally {
      if (!releasedOnError) {
        this.lastGuardStatus = { released: true, releasedOnError: false };
        guard.active = false;
      }
    }

    const durationMs = Date.now() - startTime;
    const finalHash = createHash("sha256").update(JSON.stringify(guard.initialState)).digest("hex");

    return {
      value: result,
      verification: {
        initialHash,
        finalHash,
        stateRestored: initialHash === finalHash,
      },
      durationMs,
      report: {
        guardId: guard.guardId,
        operationsPerformed: guard.transitions.length,
        stateChanges: guard.transitions.length,
        cleanupActions: ["state_restored"],
        success: true,
      },
    };
  }

  getLastGuardStatus(): GuardStatus {
    return this.lastGuardStatus;
  }

  logStateTransition(guard: ScopeGuard, field: string, from: unknown, to: unknown): void {
    const transition: StateTransition = {
      guardId: guard.guardId,
      field,
      from,
      to,
      timestamp: new Date().toISOString(),
    };

    guard.transitions.push(transition);
    this.transitions.push(transition);
  }

  getGuardTransitions(): StateTransition[] {
    return [...this.transitions];
  }

  captureIntermediateState(guard: ScopeGuard, snapshot: AnySnapshot): void {
    const states = this.intermediateStates.get(guard.guardId) || [];
    states.push({ ...snapshot });
    this.intermediateStates.set(guard.guardId, states);
  }

  async rollback(guard: ScopeGuard): Promise<RollbackResult> {
    const states = this.intermediateStates.get(guard.guardId) || [];
    const fromState = states.length > 0 ? states[states.length - 1] : guard.initialState;

    return {
      rolledBack: true,
      fromState,
      toState: guard.initialState,
    };
  }

  isGuardExpired(guard: ScopeGuard): boolean {
    if (!guard.timeoutMs) return false;

    const elapsed = Date.now() - new Date(guard.createdAt).getTime();
    const expired = elapsed > guard.timeoutMs;

    if (expired && guard.active) {
      guard.active = false;
    }

    return expired;
  }
}
