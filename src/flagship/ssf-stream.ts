/**
 * SSF Stream Manager - Shared Signals Framework Stream Management
 *
 * Manages SSF streams for real-time FLAGSHIP event delivery.
 * In-memory implementation for local use; streams are created,
 * updated, paused, and deleted through a CRUD interface.
 *
 * Each stream subscribes to specific CAEP event types and configures
 * either push (POST to endpoint) or poll (GET from server) delivery.
 */

import * as crypto from "crypto";
import type {
  SSFStream,
  SSFStreamConfig,
  FlagshipEventType,
} from "./flagship-types";

export class SSFStreamManager {
  private streams: Map<string, SSFStream> = new Map();

  /**
   * Create a new SSF stream with the given configuration.
   * The stream starts in "active" status with an auto-generated ID.
   */
  createStream(config: SSFStreamConfig): SSFStream {
    const now = new Date().toISOString();
    const stream: SSFStream = {
      streamId: `stream-${crypto.randomUUID()}`,
      status: "active",
      config: { ...config },
      createdAt: now,
      updatedAt: now,
    };

    this.streams.set(stream.streamId, stream);
    return stream;
  }

  /**
   * Update an existing stream's configuration.
   * Merges provided fields into the existing config.
   */
  updateStream(
    streamId: string,
    updates: Partial<SSFStreamConfig>,
  ): SSFStream {
    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new Error(`Stream not found: ${streamId}`);
    }

    if (updates.delivery !== undefined) {
      stream.config.delivery = updates.delivery;
    }
    if (updates.events_requested !== undefined) {
      stream.config.events_requested = updates.events_requested;
    }
    if (updates.format !== undefined) {
      stream.config.format = updates.format;
    }
    if (updates.audience !== undefined) {
      stream.config.audience = updates.audience;
    }

    stream.updatedAt = new Date().toISOString();
    return stream;
  }

  /**
   * Mark a stream as deleted. Deleted streams are excluded from listStreams
   * but remain accessible via getStream/getStreamStatus.
   */
  deleteStream(streamId: string): void {
    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new Error(`Stream not found: ${streamId}`);
    }

    stream.status = "deleted";
    stream.updatedAt = new Date().toISOString();
  }

  /**
   * Get a stream by its ID. Returns null if not found.
   */
  getStream(streamId: string): SSFStream | null {
    return this.streams.get(streamId) || null;
  }

  /**
   * Get the status of a stream by its ID. Returns null if not found.
   */
  getStreamStatus(streamId: string): SSFStream["status"] | null {
    const stream = this.streams.get(streamId);
    return stream ? stream.status : null;
  }

  /**
   * List all non-deleted streams.
   */
  listStreams(): SSFStream[] {
    return Array.from(this.streams.values()).filter(
      (s) => s.status !== "deleted",
    );
  }

  /**
   * Check if a specific event type should be delivered to a stream.
   * Returns false for deleted/nonexistent streams or unsubscribed event types.
   */
  shouldDeliver(streamId: string, eventType: FlagshipEventType): boolean {
    const stream = this.streams.get(streamId);
    if (!stream || stream.status === "deleted") {
      return false;
    }
    return stream.config.events_requested.includes(eventType);
  }
}
