#!/usr/bin/env bun
/**
 * SSF Delivery Worker — Cron Job Entry Point
 *
 * Processes the ssf_event_queue, delivering pending SET tokens
 * to stream endpoints via push delivery.
 *
 * Designed to run as a Railway cron job (e.g., every minute).
 * Exits after processing the current batch.
 *
 * Usage:
 *   bun run worker.ts
 *
 * Railway cron: */1 * * * * (every minute)
 */

import { getDb } from "./src/db/connection";
import { processDeliveryQueue } from "./functions/ssf-delivery-worker";

const db = getDb();

console.log(`[${new Date().toISOString()}] SSF Delivery Worker starting...`);

const result = await processDeliveryQueue({
  async fetchPendingEvents() {
    return (await db`
      SELECT id, stream_id, set_token, jti, status, attempts, max_attempts, next_retry
      FROM ssf_event_queue
      WHERE status = 'pending'
        AND (next_retry IS NULL OR next_retry <= NOW())
      ORDER BY id
      LIMIT 100
    `) as any;
  },

  async getStreamConfig(streamId) {
    const rows = (await db`
      SELECT config
      FROM ssf_streams
      WHERE stream_id = ${streamId}
        AND status = 'active'
    `) as Array<{ config: Record<string, unknown> | string }>;

    if (rows.length === 0) return null;

    const config = typeof rows[0].config === "string"
      ? JSON.parse(rows[0].config)
      : rows[0].config;

    const delivery = config.delivery as { endpoint_url?: string } | undefined;
    if (!delivery?.endpoint_url) return null;

    return { endpoint_url: delivery.endpoint_url };
  },

  async updateEvent(update) {
    if (update.delivered_at) {
      await db`
        UPDATE ssf_event_queue
        SET status = ${update.status},
            attempts = ${update.attempts},
            delivered_at = ${update.delivered_at}::timestamptz
        WHERE id = ${update.id}
      `;
    } else if (update.next_retry) {
      await db`
        UPDATE ssf_event_queue
        SET status = ${update.status},
            attempts = ${update.attempts},
            next_retry = ${update.next_retry}::timestamptz
        WHERE id = ${update.id}
      `;
    } else {
      await db`
        UPDATE ssf_event_queue
        SET status = ${update.status},
            attempts = ${update.attempts}
        WHERE id = ${update.id}
      `;
    }
  },

  async pushEvent(endpoint, setToken) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/secevent+jwt" },
      body: setToken,
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`Push failed: HTTP ${res.status}`);
    }

    return { delivered: true };
  },
});

console.log(
  `[${new Date().toISOString()}] Delivery complete: ` +
  `${result.delivered}/${result.processed} delivered, ` +
  `${result.failed} failed, ${result.expired} expired`,
);

process.exit(0);
