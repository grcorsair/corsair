import { randomUUID } from "crypto";

export type EventJournalStatus = "success" | "failure";

export interface EventJournalEntry {
  eventId?: string;
  eventType: string;
  eventVersion?: number;
  status?: EventJournalStatus;
  occurredAt?: string;
  actorType?: "api_key" | "oidc" | "anonymous" | "legacy";
  actorIdHash?: string;
  targetType?: string;
  targetId?: string;
  requestPath?: string;
  requestMethod?: string;
  requestId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface EventJournalWriter {
  write(entry: EventJournalEntry): Promise<void>;
}

interface DbLike {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
}

export const noOpEventJournalWriter: EventJournalWriter = {
  async write(_entry: EventJournalEntry): Promise<void> {
    // no-op on surfaces that do not persist telemetry yet
  },
};

function sanitizeMetadata(input?: Record<string, unknown>): Record<string, unknown> {
  if (!input || typeof input !== "object") return {};
  return input;
}

export function createPgEventJournalWriter(db: DbLike): EventJournalWriter {
  return {
    async write(entry: EventJournalEntry): Promise<void> {
      const eventId = entry.eventId || randomUUID();
      const eventVersion = entry.eventVersion ?? 1;
      const status = entry.status ?? "success";
      const occurredAt = entry.occurredAt || new Date().toISOString();
      const actorType = entry.actorType ?? "anonymous";
      const metadata = sanitizeMetadata(entry.metadata);

      await db`
        INSERT INTO event_journal (
          event_id,
          event_type,
          event_version,
          status,
          occurred_at,
          actor_type,
          actor_id_hash,
          target_type,
          target_id,
          request_path,
          request_method,
          request_id,
          idempotency_key,
          metadata
        ) VALUES (
          ${eventId},
          ${entry.eventType},
          ${eventVersion},
          ${status},
          ${occurredAt}::timestamptz,
          ${actorType},
          ${entry.actorIdHash || null},
          ${entry.targetType || null},
          ${entry.targetId || null},
          ${entry.requestPath || null},
          ${entry.requestMethod || null},
          ${entry.requestId || null},
          ${entry.idempotencyKey || null},
          ${JSON.stringify(metadata)}::jsonb
        )
        ON CONFLICT (event_id) DO NOTHING
      `;
    },
  };
}

export async function writeEventBestEffort(
  writer: EventJournalWriter | undefined,
  entry: EventJournalEntry,
): Promise<void> {
  if (!writer) return;
  try {
    await writer.write(entry);
  } catch (err) {
    console.error("event_journal write failed:", err);
  }
}
