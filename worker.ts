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
 * Railway cron: * /1 * * * * (every minute)
 */

import { getDb } from "./src/db/connection";
import { processDeliveryQueue } from "./functions/ssf-delivery-worker";
import { PgKeyManager } from "./src/parley/pg-key-manager";
import { verifySET } from "./src/flagship/set-generator";

const db = getDb();
const keySecretRaw = (Bun.env.CORSAIR_KEY_ENCRYPTION_SECRET || "").trim();
if (!keySecretRaw) {
  throw new Error("CORSAIR_KEY_ENCRYPTION_SECRET is required");
}
const keySecret = /^[0-9a-fA-F]{64}$/.test(keySecretRaw)
  ? Buffer.from(keySecretRaw, "hex")
  : Buffer.from(keySecretRaw, "base64");
if (keySecret.length !== 32) {
  throw new Error("CORSAIR_KEY_ENCRYPTION_SECRET must be 32 bytes");
}
const keyManager = new PgKeyManager(db as any, keySecret);

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

  async verifySet(setToken) {
    const verification = await verifySET(setToken, keyManager);
    return {
      valid: verification.valid,
      jti: typeof verification.payload?.jti === "string" ? verification.payload.jti : undefined,
    };
  },

  async isAcknowledged(streamId, jti) {
    const rows = await db`
      SELECT 1 FROM ssf_acknowledgments
      WHERE stream_id = ${streamId} AND jti = ${jti}
      LIMIT 1
    `;
    return (rows as unknown[]).length > 0;
  },

  async acknowledgeDelivery(streamId, jti) {
    await db`
      INSERT INTO ssf_acknowledgments (stream_id, jti)
      VALUES (${streamId}, ${jti})
      ON CONFLICT (stream_id, jti) DO NOTHING
    `;
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
