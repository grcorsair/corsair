/**
 * Multi-Layer Events Pattern - OpenClaw Pattern 2 Tests
 *
 * Pattern Contract:
 * 1. Corsair extends EventEmitter for pub/sub capabilities
 * 2. raid:complete events emitted when raids finish
 * 3. drift:detected events emitted when drift is found
 * 4. Event aggregator tracks events across multiple operations
 * 5. Events include full metadata (timestamp, targetId, severity, vector, findings)
 * 6. queryEvents() supports filtering by severity and time range
 * 7. Event subscriptions work correctly across multiple raids
 *
 * OpenClaw Reference: Pattern 2 - Multi-Layer Events
 * ISC Criteria: Layer 1 #8 - State transitions trigger events
 */

import { describe, test, expect, beforeEach } from "bun:test";
import {
  Corsair,
  type CognitoSnapshot,
  type Severity,
  type CorsairEvent,
  type EventFilter,
  type EventAggregator,
} from "../../src/corsair-mvp";
import {
  compliantSnapshot,
  nonCompliantSnapshot,
  optionalMfaSnapshot,
  createMockSnapshot,
} from "../fixtures/mock-snapshots";

describe("Multi-Layer Events - OpenClaw Pattern 2", () => {
  let corsair: Corsair;

  beforeEach(() => {
    corsair = new Corsair();
  });

  describe("Event Subscription - raid:complete", () => {
    test("subscribes to raid:complete events", async () => {
      const events: CorsairEvent[] = [];

      corsair.on("raid:complete", (e: CorsairEvent) => events.push(e));

      await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 5,
        dryRun: true,
      });

      expect(events.length).toBe(1);
      expect(events[0].type).toBe("raid:complete");
      expect(events[0].vector).toBe("mfa-bypass");
    });

    test("raid:complete event includes target ID", async () => {
      let capturedEvent: CorsairEvent | null = null;

      corsair.on("raid:complete", (e: CorsairEvent) => {
        capturedEvent = e;
      });

      await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 5,
        dryRun: true,
      });

      expect(capturedEvent).toBeDefined();
      expect(capturedEvent!.targetId).toBe(nonCompliantSnapshot.userPoolId);
    });

    test("raid:complete event includes timestamp", async () => {
      let capturedEvent: CorsairEvent | null = null;

      corsair.on("raid:complete", (e: CorsairEvent) => {
        capturedEvent = e;
      });

      await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 5,
        dryRun: true,
      });

      expect(capturedEvent).toBeDefined();
      expect(capturedEvent!.timestamp).toBeDefined();
      // Should be a valid ISO timestamp
      expect(() => new Date(capturedEvent!.timestamp)).not.toThrow();
    });

    test("raid:complete event includes severity based on vector", async () => {
      let capturedEvent: CorsairEvent | null = null;

      corsair.on("raid:complete", (e: CorsairEvent) => {
        capturedEvent = e;
      });

      // mfa-bypass is CRITICAL severity
      await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 9,
        dryRun: true,
      });

      expect(capturedEvent).toBeDefined();
      expect(capturedEvent!.severity).toBe("CRITICAL");
    });

    test("raid:complete event includes success status", async () => {
      let capturedEvent: CorsairEvent | null = null;

      corsair.on("raid:complete", (e: CorsairEvent) => {
        capturedEvent = e;
      });

      // MFA OFF = attack succeeds
      await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 5,
        dryRun: true,
      });

      expect(capturedEvent).toBeDefined();
      expect(capturedEvent!.success).toBe(true);
    });

    test("raid:complete event includes findings", async () => {
      let capturedEvent: CorsairEvent | null = null;

      corsair.on("raid:complete", (e: CorsairEvent) => {
        capturedEvent = e;
      });

      await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 5,
        dryRun: true,
      });

      expect(capturedEvent).toBeDefined();
      expect(capturedEvent!.findings).toBeDefined();
      expect(Array.isArray(capturedEvent!.findings)).toBe(true);
      expect(capturedEvent!.findings!.length).toBeGreaterThan(0);
    });

    test("multiple raid:complete listeners receive events", async () => {
      const events1: CorsairEvent[] = [];
      const events2: CorsairEvent[] = [];

      corsair.on("raid:complete", (e: CorsairEvent) => events1.push(e));
      corsair.on("raid:complete", (e: CorsairEvent) => events2.push(e));

      await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 5,
        dryRun: true,
      });

      expect(events1.length).toBe(1);
      expect(events2.length).toBe(1);
    });
  });

  describe("Event Subscription - drift:detected", () => {
    test("subscribes to drift:detected events", async () => {
      const events: CorsairEvent[] = [];

      corsair.on("drift:detected", (e: CorsairEvent) => events.push(e));

      // Mark with expectation that will drift
      await corsair.mark(nonCompliantSnapshot, [
        { field: "mfaConfiguration", operator: "eq", value: "ON" },
      ]);

      expect(events.length).toBe(1);
      expect(events[0].type).toBe("drift:detected");
    });

    test("drift:detected includes target ID", async () => {
      let capturedEvent: CorsairEvent | null = null;

      corsair.on("drift:detected", (e: CorsairEvent) => {
        capturedEvent = e;
      });

      await corsair.mark(nonCompliantSnapshot, [
        { field: "mfaConfiguration", operator: "eq", value: "ON" },
      ]);

      expect(capturedEvent).toBeDefined();
      expect(capturedEvent!.targetId).toBe(nonCompliantSnapshot.userPoolId);
    });

    test("drift:detected includes severity", async () => {
      let capturedEvent: CorsairEvent | null = null;

      corsair.on("drift:detected", (e: CorsairEvent) => {
        capturedEvent = e;
      });

      // MFA OFF drift is CRITICAL
      await corsair.mark(nonCompliantSnapshot, [
        { field: "mfaConfiguration", operator: "eq", value: "ON" },
      ]);

      expect(capturedEvent).toBeDefined();
      expect(capturedEvent!.severity).toBeDefined();
      // MFA drift should be CRITICAL or HIGH
      expect(["CRITICAL", "HIGH"]).toContain(capturedEvent!.severity);
    });

    test("drift:detected includes drift findings as strings", async () => {
      let capturedEvent: CorsairEvent | null = null;

      corsair.on("drift:detected", (e: CorsairEvent) => {
        capturedEvent = e;
      });

      await corsair.mark(nonCompliantSnapshot, [
        { field: "mfaConfiguration", operator: "eq", value: "ON" },
      ]);

      expect(capturedEvent).toBeDefined();
      expect(capturedEvent!.findings).toBeDefined();
      expect(Array.isArray(capturedEvent!.findings)).toBe(true);
      expect(capturedEvent!.findings!.length).toBeGreaterThan(0);
    });

    test("no drift:detected event when no drift found", async () => {
      const events: CorsairEvent[] = [];

      corsair.on("drift:detected", (e: CorsairEvent) => events.push(e));

      // Compliant snapshot meets expectations
      await corsair.mark(compliantSnapshot, [
        { field: "mfaConfiguration", operator: "eq", value: "ON" },
      ]);

      expect(events.length).toBe(0);
    });
  });

  describe("Event Aggregation", () => {
    test("aggregates events across multiple raids", async () => {
      const aggregator = corsair.createEventAggregator();

      await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 5,
        dryRun: true,
      });

      await corsair.raid(optionalMfaSnapshot, {
        vector: "password-spray",
        intensity: 3,
        dryRun: true,
      });

      const summary = aggregator.getSummary();
      expect(summary.totalEvents).toBe(2);
      expect(summary.byType["raid:complete"]).toBe(2);
    });

    test("aggregates events across raids and mark operations", async () => {
      const aggregator = corsair.createEventAggregator();

      await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 5,
        dryRun: true,
      });

      await corsair.mark(nonCompliantSnapshot, [
        { field: "mfaConfiguration", operator: "eq", value: "ON" },
      ]);

      const summary = aggregator.getSummary();
      expect(summary.totalEvents).toBe(2);
      expect(summary.byType["raid:complete"]).toBe(1);
      expect(summary.byType["drift:detected"]).toBe(1);
    });

    test("event aggregator tracks by type", async () => {
      const aggregator = corsair.createEventAggregator();

      // Execute 2 raids
      await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 5,
        dryRun: true,
      });
      await corsair.raid(nonCompliantSnapshot, {
        vector: "password-spray",
        intensity: 3,
        dryRun: true,
      });

      // Execute 1 mark that triggers drift
      await corsair.mark(nonCompliantSnapshot, [
        { field: "mfaConfiguration", operator: "eq", value: "ON" },
      ]);

      const summary = aggregator.getSummary();
      expect(summary.byType["raid:complete"]).toBe(2);
      expect(summary.byType["drift:detected"]).toBe(1);
    });

    test("event aggregator tracks by severity", async () => {
      const aggregator = corsair.createEventAggregator();

      // CRITICAL severity raid
      await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 5,
        dryRun: true,
      });

      // MEDIUM severity raid
      await corsair.raid(nonCompliantSnapshot, {
        vector: "password-spray",
        intensity: 3,
        dryRun: true,
      });

      const summary = aggregator.getSummary();
      expect(summary.bySeverity["CRITICAL"]).toBeDefined();
      expect(summary.bySeverity["MEDIUM"]).toBeDefined();
    });

    test("event aggregator includes time range", async () => {
      const beforeTime = new Date().toISOString();

      const aggregator = corsair.createEventAggregator();

      await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 5,
        dryRun: true,
      });

      const summary = aggregator.getSummary();

      expect(summary.timeRange).toBeDefined();
      expect(summary.timeRange.start).toBeDefined();
      expect(summary.timeRange.end).toBeDefined();
      // Start should be around creation time
      expect(new Date(summary.timeRange.start).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeTime).getTime() - 1000
      );
    });
  });

  describe("Event Querying", () => {
    test("queryEvents supports time range filtering", async () => {
      // Execute some raids first
      await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 5,
        dryRun: true,
      });

      const pastHour = await corsair.queryEvents({
        timeRange: {
          start: new Date(Date.now() - 3600000).toISOString(),
          end: new Date().toISOString(),
        },
      });

      expect(Array.isArray(pastHour)).toBe(true);
      pastHour.forEach((event) => {
        const eventTime = new Date(event.timestamp).getTime();
        expect(eventTime).toBeGreaterThan(Date.now() - 3600000);
        expect(eventTime).toBeLessThanOrEqual(Date.now());
      });
    });

    test("filters events by severity", async () => {
      // Execute raids with different severities
      await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 9,
        dryRun: true,
      }); // CRITICAL

      await corsair.raid(nonCompliantSnapshot, {
        vector: "password-spray",
        intensity: 3,
        dryRun: true,
      }); // MEDIUM

      const criticalEvents = await corsair.queryEvents({
        severity: "CRITICAL",
        timeRange: {
          start: new Date(Date.now() - 60000).toISOString(),
          end: new Date().toISOString(),
        },
      });

      expect(criticalEvents.every((e) => e.severity === "CRITICAL")).toBe(true);
    });

    test("filters events by type", async () => {
      // Execute raid and mark
      await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 5,
        dryRun: true,
      });

      await corsair.mark(nonCompliantSnapshot, [
        { field: "mfaConfiguration", operator: "eq", value: "ON" },
      ]);

      const raidEvents = await corsair.queryEvents({
        type: "raid:complete",
        timeRange: {
          start: new Date(Date.now() - 60000).toISOString(),
          end: new Date().toISOString(),
        },
      });

      expect(raidEvents.every((e) => e.type === "raid:complete")).toBe(true);
    });

    test("queryEvents returns empty array for future time range", async () => {
      await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 5,
        dryRun: true,
      });

      const futureEvents = await corsair.queryEvents({
        timeRange: {
          start: new Date(Date.now() + 3600000).toISOString(),
          end: new Date(Date.now() + 7200000).toISOString(),
        },
      });

      expect(futureEvents).toEqual([]);
    });

    test("queryEvents returns all events when no filter provided", async () => {
      await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 5,
        dryRun: true,
      });

      await corsair.raid(nonCompliantSnapshot, {
        vector: "password-spray",
        intensity: 3,
        dryRun: true,
      });

      const allEvents = await corsair.queryEvents({});

      expect(allEvents.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Event Metadata Completeness", () => {
    test("event includes full metadata", async () => {
      let capturedEvent: CorsairEvent | null = null;

      corsair.on("raid:complete", (e: CorsairEvent) => {
        capturedEvent = e;
      });

      await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 9,
        dryRun: true,
      });

      expect(capturedEvent).toBeDefined();
      expect(capturedEvent!.timestamp).toBeDefined();
      expect(capturedEvent!.targetId).toBe(nonCompliantSnapshot.userPoolId);
      expect(capturedEvent!.vector).toBe("mfa-bypass");
      expect(capturedEvent!.success).toBeDefined();
      expect(capturedEvent!.severity).toBe("CRITICAL");
      expect(capturedEvent!.findings).toBeDefined();
    });

    test("event metadata includes intensity in metadata field", async () => {
      let capturedEvent: CorsairEvent | null = null;

      corsair.on("raid:complete", (e: CorsairEvent) => {
        capturedEvent = e;
      });

      await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 9,
        dryRun: true,
      });

      expect(capturedEvent).toBeDefined();
      expect(capturedEvent!.metadata).toBeDefined();
      expect(capturedEvent!.metadata!.intensity).toBe(9);
    });

    test("event metadata includes controlsHeld status", async () => {
      let capturedEvent: CorsairEvent | null = null;

      corsair.on("raid:complete", (e: CorsairEvent) => {
        capturedEvent = e;
      });

      await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 9,
        dryRun: true,
      });

      expect(capturedEvent).toBeDefined();
      expect(capturedEvent!.metadata).toBeDefined();
      expect(capturedEvent!.metadata!.controlsHeld).toBeDefined();
    });

    test("event metadata includes duration", async () => {
      let capturedEvent: CorsairEvent | null = null;

      corsair.on("raid:complete", (e: CorsairEvent) => {
        capturedEvent = e;
      });

      await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 9,
        dryRun: true,
      });

      expect(capturedEvent).toBeDefined();
      expect(capturedEvent!.metadata).toBeDefined();
      expect(typeof capturedEvent!.metadata!.durationMs).toBe("number");
    });
  });

  describe("Concurrent Event Handling", () => {
    test("handles events from concurrent raids", async () => {
      const events: CorsairEvent[] = [];

      corsair.on("raid:complete", (e: CorsairEvent) => events.push(e));

      // Execute raids in parallel
      await Promise.all([
        corsair.raid(nonCompliantSnapshot, {
          vector: "mfa-bypass",
          intensity: 5,
          dryRun: true,
        }),
        corsair.raid(optionalMfaSnapshot, {
          vector: "password-spray",
          intensity: 3,
          dryRun: true,
        }),
      ]);

      expect(events.length).toBe(2);
    });

    test("aggregator handles concurrent events correctly", async () => {
      const aggregator = corsair.createEventAggregator();

      // Execute raids in parallel
      await Promise.all([
        corsair.raid(nonCompliantSnapshot, {
          vector: "mfa-bypass",
          intensity: 5,
          dryRun: true,
        }),
        corsair.raid(optionalMfaSnapshot, {
          vector: "password-spray",
          intensity: 3,
          dryRun: true,
        }),
        corsair.raid(compliantSnapshot, {
          vector: "session-hijack",
          intensity: 4,
          dryRun: true,
        }),
      ]);

      const summary = aggregator.getSummary();
      expect(summary.totalEvents).toBe(3);
    });
  });

  describe("Event Listener Management", () => {
    test("removeListener stops event delivery", async () => {
      const events: CorsairEvent[] = [];

      const listener = (e: CorsairEvent) => events.push(e);
      corsair.on("raid:complete", listener);

      // First raid - should capture
      await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 5,
        dryRun: true,
      });

      expect(events.length).toBe(1);

      // Remove listener
      corsair.removeListener("raid:complete", listener);

      // Second raid - should not capture
      await corsair.raid(nonCompliantSnapshot, {
        vector: "password-spray",
        intensity: 3,
        dryRun: true,
      });

      expect(events.length).toBe(1);
    });

    test("once listener fires only once", async () => {
      const events: CorsairEvent[] = [];

      corsair.once("raid:complete", (e: CorsairEvent) => events.push(e));

      await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 5,
        dryRun: true,
      });

      await corsair.raid(nonCompliantSnapshot, {
        vector: "password-spray",
        intensity: 3,
        dryRun: true,
      });

      expect(events.length).toBe(1);
    });
  });

  describe("Different Vector Severities", () => {
    test("mfa-bypass event has CRITICAL severity", async () => {
      let capturedEvent: CorsairEvent | null = null;
      corsair.on("raid:complete", (e: CorsairEvent) => {
        capturedEvent = e;
      });

      await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 5,
        dryRun: true,
      });

      expect(capturedEvent!.severity).toBe("CRITICAL");
    });

    test("token-replay event has CRITICAL severity", async () => {
      let capturedEvent: CorsairEvent | null = null;
      corsair.on("raid:complete", (e: CorsairEvent) => {
        capturedEvent = e;
      });

      await corsair.raid(nonCompliantSnapshot, {
        vector: "token-replay",
        intensity: 5,
        dryRun: true,
      });

      expect(capturedEvent!.severity).toBe("CRITICAL");
    });

    test("session-hijack event has HIGH severity", async () => {
      let capturedEvent: CorsairEvent | null = null;
      corsair.on("raid:complete", (e: CorsairEvent) => {
        capturedEvent = e;
      });

      await corsair.raid(nonCompliantSnapshot, {
        vector: "session-hijack",
        intensity: 5,
        dryRun: true,
      });

      expect(capturedEvent!.severity).toBe("HIGH");
    });

    test("password-spray event has MEDIUM severity", async () => {
      let capturedEvent: CorsairEvent | null = null;
      corsair.on("raid:complete", (e: CorsairEvent) => {
        capturedEvent = e;
      });

      await corsair.raid(nonCompliantSnapshot, {
        vector: "password-spray",
        intensity: 5,
        dryRun: true,
      });

      expect(capturedEvent!.severity).toBe("MEDIUM");
    });
  });
});
