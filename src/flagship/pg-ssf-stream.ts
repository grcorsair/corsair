/**
 * PgSSFStreamManager - Postgres-backed SSF Stream Management
 *
 * Persists SSF streams and event queue to Postgres.
 * All methods are async. Implements the same SSFStreamManagerInterface
 * as the in-memory version, plus event queue operations for delivery.
 */

import * as crypto from "crypto";
import type {
  SSFStream,
  SSFStreamConfig,
  FlagshipEventType,
} from "./flagship-types";
import type { SSFStreamManagerInterface } from "./ssf-stream";

export interface QueuedEvent {
  id: number;
  stream_id: string;
  set_token: string;
  jti: string;
  status: string;
  attempts: number;
  max_attempts: number;
  next_retry: string | null;
  created_at: string;
  delivered_at: string | null;
}

/**
 * Minimal DB interface for PgSSFStreamManager.
 * Matches Bun.sql tagged template usage.
 */
interface DbLike {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
}

export class PgSSFStreamManager implements SSFStreamManagerInterface {
  private db: DbLike;

  constructor(db: DbLike) {
    this.db = db;
  }

  async createStream(config: SSFStreamConfig): Promise<SSFStream> {
    const streamId = `stream-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const configJson = JSON.stringify(config);

    await this.db`
      INSERT INTO ssf_streams (stream_id, status, config, created_at, updated_at)
      VALUES (${streamId}, ${"active"}, ${configJson}::jsonb, ${now}::timestamptz, ${now}::timestamptz)
    `;

    return {
      streamId,
      status: "active",
      config: { ...config },
      createdAt: now,
      updatedAt: now,
    };
  }

  async updateStream(
    streamId: string,
    updates: Partial<SSFStreamConfig>,
  ): Promise<SSFStream> {
    const existing = await this.getStream(streamId);
    if (!existing) {
      throw new Error(`Stream not found: ${streamId}`);
    }

    // Merge updates into existing config
    const newConfig = { ...existing.config };
    if (updates.delivery !== undefined) {
      newConfig.delivery = updates.delivery;
    }
    if (updates.events_requested !== undefined) {
      newConfig.events_requested = updates.events_requested;
    }
    if (updates.format !== undefined) {
      newConfig.format = updates.format;
    }
    if (updates.audience !== undefined) {
      newConfig.audience = updates.audience;
    }

    const now = new Date().toISOString();
    const configJson = JSON.stringify(newConfig);

    await this.db`
      UPDATE ssf_streams
      SET config = ${configJson}::jsonb, updated_at = ${now}::timestamptz
      WHERE stream_id = ${streamId}
    `;

    return {
      ...existing,
      config: newConfig,
      updatedAt: now,
    };
  }

  async deleteStream(streamId: string): Promise<void> {
    const existing = await this.getStream(streamId);
    if (!existing) {
      throw new Error(`Stream not found: ${streamId}`);
    }

    const now = new Date().toISOString();
    await this.db`
      UPDATE ssf_streams
      SET status = ${"deleted"}, updated_at = ${now}::timestamptz
      WHERE stream_id = ${streamId}
    `;
  }

  async getStream(streamId: string): Promise<SSFStream | null> {
    const rows = (await this.db`
      SELECT stream_id, status, config, created_at, updated_at
      FROM ssf_streams
      WHERE stream_id = ${streamId}
    `) as Array<{
      stream_id: string;
      status: SSFStream["status"];
      config: SSFStreamConfig | string;
      created_at: string;
      updated_at: string;
    }>;

    if (rows.length === 0) return null;

    const row = rows[0]!;
    const config = typeof row.config === "string" ? JSON.parse(row.config) : row.config;

    return {
      streamId: row.stream_id,
      status: row.status,
      config,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getStreamStatus(streamId: string): Promise<SSFStream["status"] | null> {
    const stream = await this.getStream(streamId);
    return stream ? stream.status : null;
  }

  async listStreams(): Promise<SSFStream[]> {
    const rows = (await this.db`
      SELECT stream_id, status, config, created_at, updated_at
      FROM ssf_streams
      WHERE status != ${"deleted"}
    `) as Array<{
      stream_id: string;
      status: SSFStream["status"];
      config: SSFStreamConfig | string;
      created_at: string;
      updated_at: string;
    }>;

    return rows.map((row) => {
      const config = typeof row.config === "string" ? JSON.parse(row.config) : row.config;
      return {
        streamId: row.stream_id,
        status: row.status,
        config,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  }

  async shouldDeliver(streamId: string, eventType: FlagshipEventType): Promise<boolean> {
    const stream = await this.getStream(streamId);
    if (!stream || stream.status === "deleted") {
      return false;
    }
    return stream.config.events_requested.includes(eventType);
  }

  // =========================================================================
  // EVENT QUEUE OPERATIONS
  // =========================================================================

  async queueEvent(streamId: string, setToken: string, jti: string): Promise<void> {
    await this.db`
      INSERT INTO ssf_event_queue (stream_id, set_token, jti, status, attempts)
      VALUES (${streamId}, ${setToken}, ${jti}, ${"pending"}, ${0})
    `;
  }

  async getPendingEvents(limit: number = 100): Promise<QueuedEvent[]> {
    return (await this.db`
      SELECT id, stream_id, set_token, jti, status, attempts, max_attempts, next_retry, created_at, delivered_at
      FROM ssf_event_queue
      WHERE status = ${"pending"}
      LIMIT ${limit}
    `) as QueuedEvent[];
  }

  async markDelivered(eventId: number): Promise<void> {
    await this.db`
      UPDATE ssf_event_queue
      SET status = ${"delivered"}, delivered_at = ${new Date().toISOString()}::timestamptz
      WHERE id = ${eventId}
    `;
  }

  async markFailed(eventId: number, nextRetry: Date): Promise<void> {
    await this.db`
      UPDATE ssf_event_queue
      SET status = ${"failed"}, attempts = attempts + 1, next_retry = ${nextRetry.toISOString()}::timestamptz
      WHERE id = ${eventId}
    `;
  }

  async acknowledgeEvent(streamId: string, jti: string): Promise<void> {
    await this.db`
      INSERT INTO ssf_acknowledgments (stream_id, jti)
      VALUES (${streamId}, ${jti})
    `;
  }

  async isAcknowledged(streamId: string, jti: string): Promise<boolean> {
    const rows = await this.db`
      SELECT 1 FROM ssf_acknowledgments
      WHERE stream_id = ${streamId} AND jti = ${jti}
    `;
    return (rows as unknown[]).length > 0;
  }
}

// =============================================================================
// FACTORY
// =============================================================================

import { MemorySSFStreamManager } from "./ssf-stream";

/**
 * Factory to create either an in-memory or Postgres-backed stream manager.
 */
export function createStreamManager(
  mode: "memory" | "postgres",
  db?: DbLike,
): SSFStreamManagerInterface {
  if (mode === "postgres") {
    if (!db) {
      throw new Error("Postgres mode requires a db connection argument");
    }
    return new PgSSFStreamManager(db);
  }
  return new MemorySSFStreamManager();
}
