/**
 * MARK Engine - Drift Detection
 *
 * Extracted from corsair-mvp.ts.
 * Compares reality (snapshot) against expectations to identify security drift.
 */

import { EventEmitter } from "events";
import type {
  CognitoSnapshot,
  Expectation,
  DriftFinding,
  MarkResult,
  Severity,
  CorsairEvent,
} from "../types";

/** Any snapshot shape accepted by MarkEngine. CognitoSnapshot is the legacy default. */
type AnySnapshot = CognitoSnapshot | Record<string, unknown>;

export class MarkEngine {
  private emitter: EventEmitter;
  private events: CorsairEvent[];

  constructor(emitter: EventEmitter, events: CorsairEvent[]) {
    this.emitter = emitter;
    this.events = events;
  }

  async mark(snapshot: AnySnapshot, expectations: Expectation[]): Promise<MarkResult> {
    const startTime = Date.now();
    const findings: DriftFinding[] = [];

    for (const expectation of expectations) {
      const actual = this.getNestedValue(snapshot, expectation.field);
      const expected = expectation.value;
      const drift = !this.checkExpectation(actual, expectation);
      const severity = this.calculateSeverity(expectation.field, drift, actual);

      findings.push({
        id: `DRIFT-${crypto.randomUUID().slice(0, 8)}`,
        field: expectation.field,
        expected,
        actual,
        drift,
        severity,
        description: this.generateDescription(expectation.field, expected, actual, drift),
        timestamp: new Date().toISOString(),
      });
    }

    const durationMs = Date.now() - startTime;
    const driftDetected = findings.some(f => f.drift === true);

    if (driftDetected) {
      const driftFindings = findings.filter(f => f.drift);
      const maxSeverity = this.getDriftMaxSeverity(driftFindings);

      // Extract targetId from snapshot — works for any provider shape
      const targetId = (snapshot as Record<string, unknown>).userPoolId as string
        || (snapshot as Record<string, unknown>).bucketName as string
        || (snapshot as Record<string, unknown>).resourceId as string
        || "unknown";

      const event: CorsairEvent = {
        type: "drift:detected",
        timestamp: new Date().toISOString(),
        targetId,
        severity: maxSeverity,
        findings: driftFindings.map(d => `${d.field}: ${JSON.stringify(d.expected)} -> ${JSON.stringify(d.actual)}`),
        metadata: {
          driftCount: driftFindings.length,
          durationMs,
        },
      };

      this.emitter.emit("drift:detected", event);
      this.events.push(event);
    }

    return {
      findings,
      driftDetected,
      durationMs,
    };
  }

  private getDriftMaxSeverity(driftFindings: DriftFinding[]): Severity {
    const severityOrder: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
    let maxIndex = 0;

    for (const finding of driftFindings) {
      const index = severityOrder.indexOf(finding.severity);
      if (index > maxIndex) {
        maxIndex = index;
      }
    }

    return severityOrder[maxIndex];
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private checkExpectation(actual: unknown, expectation: Expectation): boolean {
    const { operator, value } = expectation;

    switch (operator) {
      case "eq":
        return actual === value;
      case "neq":
        return actual !== value;
      case "gt":
        return typeof actual === "number" && typeof value === "number" && actual > value;
      case "gte":
        return typeof actual === "number" && typeof value === "number" && actual >= value;
      case "lt":
        return typeof actual === "number" && typeof value === "number" && actual < value;
      case "lte":
        return typeof actual === "number" && typeof value === "number" && actual <= value;
      case "exists":
        return value ? actual !== null && actual !== undefined : actual === null || actual === undefined;
      case "contains":
        return typeof actual === "string" && typeof value === "string" && actual.includes(value);
      default:
        return false;
    }
  }

  private calculateSeverity(field: string, drift: boolean, actual: unknown): Severity {
    if (!drift) return "LOW";

    if (field === "mfaConfiguration" && actual === "OFF") {
      return "CRITICAL";
    }

    if (field === "mfaConfiguration" && actual === "OPTIONAL") {
      return "HIGH";
    }

    if (field === "riskConfiguration" && actual === null) {
      return "HIGH";
    }

    if (field.startsWith("passwordPolicy")) {
      return "MEDIUM";
    }

    return "MEDIUM";
  }

  private generateDescription(field: string, expected: unknown, actual: unknown, drift: boolean): string {
    if (!drift) {
      return `${field} meets expectation (${actual})`;
    }

    return `${field} drift detected: expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`;
  }
}
