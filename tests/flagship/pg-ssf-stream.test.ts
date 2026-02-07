/**
 * PgSSFStreamManager Tests — Live Postgres Integration
 *
 * Tests Postgres-backed SSF stream management against the Railway Postgres.
 * Each test cleans up its data to ensure isolation.
 */
import { describe, test, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { SQL } from "bun";
import { PgSSFStreamManager, createStreamManager } from "../../src/flagship/pg-ssf-stream";
import { MemorySSFStreamManager } from "../../src/flagship/ssf-stream";
import {
  FLAGSHIP_EVENTS,
  type SSFStreamConfig,
} from "../../src/flagship/flagship-types";

// =============================================================================
// LIVE DATABASE SETUP
// =============================================================================

let db: InstanceType<typeof SQL>;
let manager: PgSSFStreamManager;

beforeEach(async () => {
  db = new SQL({ url: process.env.DATABASE_URL });
  manager = new PgSSFStreamManager(db as never);

  // Clean tables in FK-safe order
  await db`DELETE FROM ssf_event_queue`;
  await db`DELETE FROM ssf_acknowledgments`;
  await db`DELETE FROM ssf_streams`;
});

afterEach(async () => {
  // Clean up after each test
  try {
    await db`DELETE FROM ssf_event_queue`;
    await db`DELETE FROM ssf_acknowledgments`;
    await db`DELETE FROM ssf_streams`;
  } catch {}
  if (db) db.close();
});

// =============================================================================
// STREAM CRUD
// =============================================================================

describe("PgSSFStreamManager (live Postgres)", () => {
  describe("createStream", () => {
    test("creates a stream with auto-generated ID and active status", async () => {
      const config: SSFStreamConfig = {
        delivery: {
          method: "push",
          endpoint_url: "https://receiver.example.com/events",
        },
        events_requested: [FLAGSHIP_EVENTS.COLORS_CHANGED],
        format: "jwt",
      };

      const stream = await manager.createStream(config);

      expect(stream.streamId).toBeDefined();
      expect(stream.streamId.startsWith("stream-")).toBe(true);
      expect(stream.status).toBe("active");
      expect(stream.config).toEqual(config);
      expect(stream.createdAt).toBeDefined();
      expect(stream.updatedAt).toBeDefined();

      // Verify it was actually persisted in Postgres
      const rows = await db`SELECT stream_id, status FROM ssf_streams WHERE stream_id = ${stream.streamId}`;
      expect(rows.length).toBe(1);
      expect(rows[0].status).toBe("active");
    });

    test("each stream gets a unique ID", async () => {
      const config: SSFStreamConfig = {
        delivery: { method: "poll" },
        events_requested: [FLAGSHIP_EVENTS.FLEET_ALERT],
        format: "jwt",
      };

      const stream1 = await manager.createStream(config);
      const stream2 = await manager.createStream(config);

      expect(stream1.streamId).not.toBe(stream2.streamId);
    });

    test("stores JSONB config and reads it back correctly", async () => {
      const config: SSFStreamConfig = {
        delivery: {
          method: "push",
          endpoint_url: "https://receiver.example.com/events",
        },
        events_requested: [
          FLAGSHIP_EVENTS.COLORS_CHANGED,
          FLAGSHIP_EVENTS.FLEET_ALERT,
          FLAGSHIP_EVENTS.PAPERS_CHANGED,
        ],
        format: "jwt",
        audience: "https://audience.example.com",
      };

      const created = await manager.createStream(config);
      const fetched = await manager.getStream(created.streamId);

      expect(fetched).not.toBeNull();
      expect(fetched!.config.delivery.method).toBe("push");
      expect(fetched!.config.delivery.endpoint_url).toBe("https://receiver.example.com/events");
      expect(fetched!.config.events_requested).toHaveLength(3);
      expect(fetched!.config.format).toBe("jwt");
      expect(fetched!.config.audience).toBe("https://audience.example.com");
    });
  });

  describe("getStream", () => {
    test("returns the stream by ID from Postgres", async () => {
      const config: SSFStreamConfig = {
        delivery: { method: "poll" },
        events_requested: [FLAGSHIP_EVENTS.FLEET_ALERT],
        format: "jwt",
      };

      const created = await manager.createStream(config);
      const fetched = await manager.getStream(created.streamId);

      expect(fetched).not.toBeNull();
      expect(fetched!.streamId).toBe(created.streamId);
      expect(fetched!.status).toBe("active");
    });

    test("returns null for nonexistent stream ID", async () => {
      const result = await manager.getStream("nonexistent-id");
      expect(result).toBeNull();
    });
  });

  describe("getStreamStatus", () => {
    test("returns the status of an existing stream", async () => {
      const config: SSFStreamConfig = {
        delivery: { method: "poll" },
        events_requested: [FLAGSHIP_EVENTS.FLEET_ALERT],
        format: "jwt",
      };

      const stream = await manager.createStream(config);
      const status = await manager.getStreamStatus(stream.streamId);
      expect(status).toBe("active");
    });

    test("returns null for nonexistent stream", async () => {
      const status = await manager.getStreamStatus("nonexistent");
      expect(status).toBeNull();
    });
  });

  describe("updateStream", () => {
    test("updates delivery configuration and persists to Postgres", async () => {
      const config: SSFStreamConfig = {
        delivery: { method: "poll" },
        events_requested: [FLAGSHIP_EVENTS.FLEET_ALERT],
        format: "jwt",
      };

      const stream = await manager.createStream(config);
      const updated = await manager.updateStream(stream.streamId, {
        delivery: {
          method: "push",
          endpoint_url: "https://new.example.com/events",
        },
      });

      expect(updated.config.delivery.method).toBe("push");
      expect(updated.config.delivery.endpoint_url).toBe("https://new.example.com/events");

      // Verify persistence: re-read from DB
      const refetched = await manager.getStream(stream.streamId);
      expect(refetched!.config.delivery.method).toBe("push");
    });

    test("updates events_requested list", async () => {
      const config: SSFStreamConfig = {
        delivery: { method: "poll" },
        events_requested: [FLAGSHIP_EVENTS.FLEET_ALERT],
        format: "jwt",
      };

      const stream = await manager.createStream(config);
      const updated = await manager.updateStream(stream.streamId, {
        events_requested: [
          FLAGSHIP_EVENTS.FLEET_ALERT,
          FLAGSHIP_EVENTS.MARQUE_REVOKED,
        ],
      });

      expect(updated.config.events_requested).toHaveLength(2);
      expect(updated.config.events_requested).toContain(FLAGSHIP_EVENTS.MARQUE_REVOKED);
    });

    test("throws error for nonexistent stream", async () => {
      await expect(
        manager.updateStream("nonexistent", {
          events_requested: [FLAGSHIP_EVENTS.FLEET_ALERT],
        }),
      ).rejects.toThrow();
    });
  });

  describe("deleteStream", () => {
    test("marks stream as deleted in Postgres", async () => {
      const config: SSFStreamConfig = {
        delivery: { method: "poll" },
        events_requested: [FLAGSHIP_EVENTS.FLEET_ALERT],
        format: "jwt",
      };

      const stream = await manager.createStream(config);
      await manager.deleteStream(stream.streamId);

      const status = await manager.getStreamStatus(stream.streamId);
      expect(status).toBe("deleted");

      // Verify directly in Postgres
      const rows = await db`SELECT status FROM ssf_streams WHERE stream_id = ${stream.streamId}`;
      expect(rows[0].status).toBe("deleted");
    });

    test("deleted stream excluded from listStreams", async () => {
      const config: SSFStreamConfig = {
        delivery: { method: "poll" },
        events_requested: [FLAGSHIP_EVENTS.FLEET_ALERT],
        format: "jwt",
      };

      const s1 = await manager.createStream(config);
      const s2 = await manager.createStream(config);
      await manager.deleteStream(s1.streamId);

      const streams = await manager.listStreams();
      expect(streams).toHaveLength(1);
      expect(streams[0].streamId).toBe(s2.streamId);
    });

    test("throws error for nonexistent stream", async () => {
      await expect(manager.deleteStream("nonexistent")).rejects.toThrow();
    });
  });

  describe("listStreams", () => {
    test("returns empty array when no streams exist", async () => {
      const streams = await manager.listStreams();
      expect(streams).toEqual([]);
    });

    test("returns all active streams from Postgres", async () => {
      const config: SSFStreamConfig = {
        delivery: { method: "poll" },
        events_requested: [FLAGSHIP_EVENTS.FLEET_ALERT],
        format: "jwt",
      };

      await manager.createStream(config);
      await manager.createStream(config);
      await manager.createStream(config);

      const streams = await manager.listStreams();
      expect(streams.length).toBe(3);
    });
  });

  describe("shouldDeliver", () => {
    test("returns true for subscribed event type", async () => {
      const config: SSFStreamConfig = {
        delivery: { method: "poll" },
        events_requested: [
          FLAGSHIP_EVENTS.COLORS_CHANGED,
          FLAGSHIP_EVENTS.FLEET_ALERT,
        ],
        format: "jwt",
      };

      const stream = await manager.createStream(config);
      expect(
        await manager.shouldDeliver(stream.streamId, FLAGSHIP_EVENTS.COLORS_CHANGED),
      ).toBe(true);
      expect(
        await manager.shouldDeliver(stream.streamId, FLAGSHIP_EVENTS.FLEET_ALERT),
      ).toBe(true);
    });

    test("returns false for non-subscribed event type", async () => {
      const config: SSFStreamConfig = {
        delivery: { method: "poll" },
        events_requested: [FLAGSHIP_EVENTS.COLORS_CHANGED],
        format: "jwt",
      };

      const stream = await manager.createStream(config);
      expect(
        await manager.shouldDeliver(stream.streamId, FLAGSHIP_EVENTS.FLEET_ALERT),
      ).toBe(false);
    });

    test("returns false for deleted stream", async () => {
      const config: SSFStreamConfig = {
        delivery: { method: "poll" },
        events_requested: [FLAGSHIP_EVENTS.COLORS_CHANGED],
        format: "jwt",
      };

      const stream = await manager.createStream(config);
      await manager.deleteStream(stream.streamId);

      expect(
        await manager.shouldDeliver(stream.streamId, FLAGSHIP_EVENTS.COLORS_CHANGED),
      ).toBe(false);
    });

    test("returns false for nonexistent stream", async () => {
      expect(
        await manager.shouldDeliver("nonexistent", FLAGSHIP_EVENTS.COLORS_CHANGED),
      ).toBe(false);
    });
  });

  // ===========================================================================
  // EVENT QUEUE
  // ===========================================================================

  describe("queueEvent", () => {
    test("inserts a pending event into ssf_event_queue", async () => {
      const config: SSFStreamConfig = {
        delivery: { method: "push", endpoint_url: "https://example.com" },
        events_requested: [FLAGSHIP_EVENTS.COLORS_CHANGED],
        format: "jwt",
      };

      const stream = await manager.createStream(config);
      await manager.queueEvent(stream.streamId, "jwt-token-here", "jti-123");

      // Verify directly in Postgres
      const rows = await db`SELECT stream_id, jti, status FROM ssf_event_queue WHERE stream_id = ${stream.streamId}`;
      expect(rows.length).toBe(1);
      expect(rows[0].jti).toBe("jti-123");
      expect(rows[0].status).toBe("pending");
    });
  });

  describe("getPendingEvents", () => {
    test("returns pending events from Postgres up to limit", async () => {
      const config: SSFStreamConfig = {
        delivery: { method: "push", endpoint_url: "https://example.com" },
        events_requested: [FLAGSHIP_EVENTS.COLORS_CHANGED],
        format: "jwt",
      };

      const stream = await manager.createStream(config);
      await manager.queueEvent(stream.streamId, "token-1", "jti-1");
      await manager.queueEvent(stream.streamId, "token-2", "jti-2");
      await manager.queueEvent(stream.streamId, "token-3", "jti-3");

      const pending = await manager.getPendingEvents(2);
      expect(pending.length).toBe(2);
      expect(pending[0].status).toBe("pending");
    });

    test("returns all pending when no limit specified", async () => {
      const config: SSFStreamConfig = {
        delivery: { method: "push", endpoint_url: "https://example.com" },
        events_requested: [FLAGSHIP_EVENTS.COLORS_CHANGED],
        format: "jwt",
      };

      const stream = await manager.createStream(config);
      await manager.queueEvent(stream.streamId, "token-1", "jti-1");
      await manager.queueEvent(stream.streamId, "token-2", "jti-2");

      const pending = await manager.getPendingEvents();
      expect(pending.length).toBe(2);
    });
  });

  describe("markDelivered", () => {
    test("marks event as delivered in Postgres", async () => {
      const config: SSFStreamConfig = {
        delivery: { method: "push", endpoint_url: "https://example.com" },
        events_requested: [FLAGSHIP_EVENTS.COLORS_CHANGED],
        format: "jwt",
      };

      const stream = await manager.createStream(config);
      await manager.queueEvent(stream.streamId, "token-1", "jti-1");

      const pending = await manager.getPendingEvents(10);
      expect(pending.length).toBe(1);
      const eventId = pending[0].id;

      await manager.markDelivered(eventId);

      // Should no longer appear in pending
      const stillPending = await manager.getPendingEvents(10);
      expect(stillPending.length).toBe(0);

      // Verify delivered_at is set
      const rows = await db`SELECT status, delivered_at FROM ssf_event_queue WHERE id = ${eventId}`;
      expect(rows[0].status).toBe("delivered");
      expect(rows[0].delivered_at).not.toBeNull();
    });
  });

  describe("markFailed", () => {
    test("marks event as failed with incremented attempts", async () => {
      const config: SSFStreamConfig = {
        delivery: { method: "push", endpoint_url: "https://example.com" },
        events_requested: [FLAGSHIP_EVENTS.COLORS_CHANGED],
        format: "jwt",
      };

      const stream = await manager.createStream(config);
      await manager.queueEvent(stream.streamId, "token-1", "jti-1");

      const pending = await manager.getPendingEvents(10);
      const eventId = pending[0].id;

      const nextRetry = new Date(Date.now() + 60000);
      await manager.markFailed(eventId, nextRetry);

      // Verify in Postgres
      const rows = await db`SELECT status, attempts, next_retry FROM ssf_event_queue WHERE id = ${eventId}`;
      expect(rows[0].status).toBe("failed");
      expect(rows[0].attempts).toBe(1);
      expect(rows[0].next_retry).not.toBeNull();
    });
  });

  describe("acknowledgeEvent", () => {
    test("records acknowledgment in ssf_acknowledgments", async () => {
      const config: SSFStreamConfig = {
        delivery: { method: "push", endpoint_url: "https://example.com" },
        events_requested: [FLAGSHIP_EVENTS.COLORS_CHANGED],
        format: "jwt",
      };

      const stream = await manager.createStream(config);
      await manager.acknowledgeEvent(stream.streamId, "jti-123");

      // Verify in Postgres
      const rows = await db`
        SELECT stream_id, jti FROM ssf_acknowledgments
        WHERE stream_id = ${stream.streamId} AND jti = ${"jti-123"}
      `;
      expect(rows.length).toBe(1);
    });
  });

  describe("isAcknowledged", () => {
    test("returns false before acknowledgment", async () => {
      const config: SSFStreamConfig = {
        delivery: { method: "push", endpoint_url: "https://example.com" },
        events_requested: [FLAGSHIP_EVENTS.COLORS_CHANGED],
        format: "jwt",
      };

      const stream = await manager.createStream(config);
      expect(await manager.isAcknowledged(stream.streamId, "jti-001")).toBe(false);
    });

    test("returns true after acknowledgment", async () => {
      const config: SSFStreamConfig = {
        delivery: { method: "push", endpoint_url: "https://example.com" },
        events_requested: [FLAGSHIP_EVENTS.COLORS_CHANGED],
        format: "jwt",
      };

      const stream = await manager.createStream(config);
      await manager.acknowledgeEvent(stream.streamId, "jti-001");
      expect(await manager.isAcknowledged(stream.streamId, "jti-001")).toBe(true);
    });
  });
});

// =============================================================================
// FACTORY TESTS
// =============================================================================

describe("createStreamManager factory", () => {
  test("returns MemorySSFStreamManager for memory mode", () => {
    const mgr = createStreamManager("memory");
    expect(mgr).toBeInstanceOf(MemorySSFStreamManager);
  });

  test("returns PgSSFStreamManager for postgres mode with live DB", () => {
    const liveDb = new SQL({ url: process.env.DATABASE_URL });
    const mgr = createStreamManager("postgres", liveDb as never);
    expect(mgr).toBeInstanceOf(PgSSFStreamManager);
    liveDb.close();
  });

  test("throws for postgres mode without db", () => {
    expect(() => createStreamManager("postgres")).toThrow();
  });
});
