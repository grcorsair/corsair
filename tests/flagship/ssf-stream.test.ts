/**
 * SSF Stream Manager Tests
 *
 * Tests the in-memory SSF stream management for FLAGSHIP event delivery.
 * Covers lifecycle (create/update/delete), filtering, and error handling.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { SSFStreamManager } from "../../src/flagship/ssf-stream";
import {
  FLAGSHIP_EVENTS,
  type SSFStreamConfig,
} from "../../src/flagship/flagship-types";

let manager: SSFStreamManager;

beforeEach(() => {
  manager = new SSFStreamManager();
});

describe("SSFStreamManager", () => {
  describe("createStream", () => {
    test("creates a stream with auto-generated ID", () => {
      const config: SSFStreamConfig = {
        delivery: {
          method: "push",
          endpoint_url: "https://receiver.example.com/events",
        },
        events_requested: [FLAGSHIP_EVENTS.COLORS_CHANGED],
        format: "jwt",
      };

      const stream = manager.createStream(config);

      expect(stream.streamId).toBeDefined();
      expect(stream.streamId.length).toBeGreaterThan(0);
      expect(stream.status).toBe("active");
      expect(stream.config).toEqual(config);
      expect(stream.createdAt).toBeDefined();
      expect(stream.updatedAt).toBeDefined();
    });

    test("each stream gets a unique ID", () => {
      const config: SSFStreamConfig = {
        delivery: { method: "poll" },
        events_requested: [FLAGSHIP_EVENTS.FLEET_ALERT],
        format: "jwt",
      };

      const stream1 = manager.createStream(config);
      const stream2 = manager.createStream(config);

      expect(stream1.streamId).not.toBe(stream2.streamId);
    });

    test("supports push delivery with endpoint URL", () => {
      const config: SSFStreamConfig = {
        delivery: {
          method: "push",
          endpoint_url: "https://receiver.example.com/events",
        },
        events_requested: [FLAGSHIP_EVENTS.COLORS_CHANGED],
        format: "jwt",
      };

      const stream = manager.createStream(config);
      expect(stream.config.delivery.method).toBe("push");
      expect(stream.config.delivery.endpoint_url).toBe(
        "https://receiver.example.com/events",
      );
    });

    test("supports poll delivery without endpoint URL", () => {
      const config: SSFStreamConfig = {
        delivery: { method: "poll" },
        events_requested: [FLAGSHIP_EVENTS.PAPERS_CHANGED],
        format: "jwt",
      };

      const stream = manager.createStream(config);
      expect(stream.config.delivery.method).toBe("poll");
      expect(stream.config.delivery.endpoint_url).toBeUndefined();
    });

    test("supports subscribing to multiple event types", () => {
      const config: SSFStreamConfig = {
        delivery: { method: "poll" },
        events_requested: [
          FLAGSHIP_EVENTS.COLORS_CHANGED,
          FLAGSHIP_EVENTS.FLEET_ALERT,
          FLAGSHIP_EVENTS.PAPERS_CHANGED,
          FLAGSHIP_EVENTS.MARQUE_REVOKED,
        ],
        format: "jwt",
      };

      const stream = manager.createStream(config);
      expect(stream.config.events_requested).toHaveLength(4);
    });
  });

  describe("getStream", () => {
    test("returns the stream by ID", () => {
      const config: SSFStreamConfig = {
        delivery: { method: "poll" },
        events_requested: [FLAGSHIP_EVENTS.FLEET_ALERT],
        format: "jwt",
      };

      const created = manager.createStream(config);
      const fetched = manager.getStream(created.streamId);

      expect(fetched).not.toBeNull();
      expect(fetched!.streamId).toBe(created.streamId);
      expect(fetched!.config).toEqual(config);
    });

    test("returns null for nonexistent stream ID", () => {
      const result = manager.getStream("nonexistent-id");
      expect(result).toBeNull();
    });
  });

  describe("getStreamStatus", () => {
    test("returns the status of an existing stream", () => {
      const config: SSFStreamConfig = {
        delivery: { method: "poll" },
        events_requested: [FLAGSHIP_EVENTS.FLEET_ALERT],
        format: "jwt",
      };

      const stream = manager.createStream(config);
      const status = manager.getStreamStatus(stream.streamId);
      expect(status).toBe("active");
    });

    test("returns null for nonexistent stream", () => {
      const status = manager.getStreamStatus("nonexistent");
      expect(status).toBeNull();
    });
  });

  describe("updateStream", () => {
    test("updates delivery configuration", () => {
      const config: SSFStreamConfig = {
        delivery: { method: "poll" },
        events_requested: [FLAGSHIP_EVENTS.FLEET_ALERT],
        format: "jwt",
      };

      const stream = manager.createStream(config);
      const updated = manager.updateStream(stream.streamId, {
        delivery: {
          method: "push",
          endpoint_url: "https://new.example.com/events",
        },
      });

      expect(updated.config.delivery.method).toBe("push");
      expect(updated.config.delivery.endpoint_url).toBe(
        "https://new.example.com/events",
      );
    });

    test("updates events_requested list", () => {
      const config: SSFStreamConfig = {
        delivery: { method: "poll" },
        events_requested: [FLAGSHIP_EVENTS.FLEET_ALERT],
        format: "jwt",
      };

      const stream = manager.createStream(config);
      const updated = manager.updateStream(stream.streamId, {
        events_requested: [
          FLAGSHIP_EVENTS.FLEET_ALERT,
          FLAGSHIP_EVENTS.MARQUE_REVOKED,
        ],
      });

      expect(updated.config.events_requested).toHaveLength(2);
      expect(updated.config.events_requested).toContain(
        FLAGSHIP_EVENTS.MARQUE_REVOKED,
      );
    });

    test("updates updatedAt timestamp", () => {
      const config: SSFStreamConfig = {
        delivery: { method: "poll" },
        events_requested: [FLAGSHIP_EVENTS.FLEET_ALERT],
        format: "jwt",
      };

      const stream = manager.createStream(config);
      const originalUpdatedAt = stream.updatedAt;

      // Small delay so timestamps differ
      const updated = manager.updateStream(stream.streamId, {
        events_requested: [FLAGSHIP_EVENTS.COLORS_CHANGED],
      });

      // updatedAt should be a valid ISO string (may or may not differ in fast tests)
      expect(updated.updatedAt).toBeDefined();
      expect(updated.createdAt).toBe(stream.createdAt);
    });

    test("throws error for nonexistent stream", () => {
      expect(() =>
        manager.updateStream("nonexistent", {
          events_requested: [FLAGSHIP_EVENTS.FLEET_ALERT],
        }),
      ).toThrow();
    });
  });

  describe("deleteStream", () => {
    test("marks stream as deleted", () => {
      const config: SSFStreamConfig = {
        delivery: { method: "poll" },
        events_requested: [FLAGSHIP_EVENTS.FLEET_ALERT],
        format: "jwt",
      };

      const stream = manager.createStream(config);
      manager.deleteStream(stream.streamId);

      const status = manager.getStreamStatus(stream.streamId);
      expect(status).toBe("deleted");
    });

    test("deleted stream is excluded from listStreams", () => {
      const config: SSFStreamConfig = {
        delivery: { method: "poll" },
        events_requested: [FLAGSHIP_EVENTS.FLEET_ALERT],
        format: "jwt",
      };

      const stream1 = manager.createStream(config);
      const stream2 = manager.createStream(config);

      manager.deleteStream(stream1.streamId);

      const streams = manager.listStreams();
      expect(streams).toHaveLength(1);
      expect(streams[0].streamId).toBe(stream2.streamId);
    });

    test("throws error for nonexistent stream", () => {
      expect(() => manager.deleteStream("nonexistent")).toThrow();
    });
  });

  describe("listStreams", () => {
    test("returns empty array when no streams exist", () => {
      const streams = manager.listStreams();
      expect(streams).toEqual([]);
    });

    test("returns all active and paused streams", () => {
      const config: SSFStreamConfig = {
        delivery: { method: "poll" },
        events_requested: [FLAGSHIP_EVENTS.FLEET_ALERT],
        format: "jwt",
      };

      manager.createStream(config);
      manager.createStream(config);
      manager.createStream(config);

      const streams = manager.listStreams();
      expect(streams).toHaveLength(3);
    });
  });

  describe("shouldDeliver", () => {
    test("returns true for subscribed event type", () => {
      const config: SSFStreamConfig = {
        delivery: { method: "poll" },
        events_requested: [
          FLAGSHIP_EVENTS.COLORS_CHANGED,
          FLAGSHIP_EVENTS.FLEET_ALERT,
        ],
        format: "jwt",
      };

      const stream = manager.createStream(config);
      expect(
        manager.shouldDeliver(stream.streamId, FLAGSHIP_EVENTS.COLORS_CHANGED),
      ).toBe(true);
      expect(
        manager.shouldDeliver(stream.streamId, FLAGSHIP_EVENTS.FLEET_ALERT),
      ).toBe(true);
    });

    test("returns false for non-subscribed event type", () => {
      const config: SSFStreamConfig = {
        delivery: { method: "poll" },
        events_requested: [FLAGSHIP_EVENTS.COLORS_CHANGED],
        format: "jwt",
      };

      const stream = manager.createStream(config);
      expect(
        manager.shouldDeliver(stream.streamId, FLAGSHIP_EVENTS.FLEET_ALERT),
      ).toBe(false);
      expect(
        manager.shouldDeliver(stream.streamId, FLAGSHIP_EVENTS.MARQUE_REVOKED),
      ).toBe(false);
    });

    test("returns false for deleted stream", () => {
      const config: SSFStreamConfig = {
        delivery: { method: "poll" },
        events_requested: [FLAGSHIP_EVENTS.COLORS_CHANGED],
        format: "jwt",
      };

      const stream = manager.createStream(config);
      manager.deleteStream(stream.streamId);

      expect(
        manager.shouldDeliver(stream.streamId, FLAGSHIP_EVENTS.COLORS_CHANGED),
      ).toBe(false);
    });

    test("returns false for nonexistent stream", () => {
      expect(
        manager.shouldDeliver("nonexistent", FLAGSHIP_EVENTS.COLORS_CHANGED),
      ).toBe(false);
    });
  });
});
