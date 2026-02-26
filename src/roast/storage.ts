import type { RoastResult } from "./types";

interface RoastStoreRow {
  id: string;
  domain: string;
  composite_score: number;
  verdict: string;
  result_json: unknown;
  created_at: Date | string;
  expires_at: Date | string;
}

interface RoastDb {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
}

export interface RoastStore {
  save(result: RoastResult, ttlDays: number): Promise<void>;
  get(id: string): Promise<RoastResult | null>;
}

function toIso(input: Date | string): string {
  if (input instanceof Date) return input.toISOString();
  return input;
}

function parseResultJson(value: unknown): RoastResult | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as RoastResult;
    } catch {
      return null;
    }
  }
  if (typeof value === "object") {
    return value as RoastResult;
  }
  return null;
}

export function createRoastStore(db: RoastDb): RoastStore {
  return {
    async save(result: RoastResult, ttlDays: number) {
      const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
      await db`
        INSERT INTO roast_results (
          id, domain, composite_score, verdict, result_json, created_at, expires_at
        ) VALUES (
          ${result.id}, ${result.domain}, ${result.compositeScore}, ${result.verdict},
          ${JSON.stringify(result)}, ${result.createdAt}, ${expiresAt}
        )
        ON CONFLICT (id) DO UPDATE SET
          domain = EXCLUDED.domain,
          composite_score = EXCLUDED.composite_score,
          verdict = EXCLUDED.verdict,
          result_json = EXCLUDED.result_json,
          created_at = EXCLUDED.created_at,
          expires_at = EXCLUDED.expires_at
      `;
    },

    async get(id: string) {
      const rows = await db`
        SELECT id, domain, composite_score, verdict, result_json, created_at, expires_at
        FROM roast_results
        WHERE id = ${id} AND expires_at > NOW()
        LIMIT 1
      ` as RoastStoreRow[];

      if (!rows || rows.length === 0) return null;
      const row = rows[0];
      const parsed = parseResultJson(row.result_json);
      if (!parsed) return null;

      return {
        ...parsed,
        createdAt: parsed.createdAt || toIso(row.created_at),
      };
    },
  };
}

export function createMemoryRoastStore(): RoastStore {
  const map = new Map<string, { result: RoastResult; expiresAt: number }>();

  return {
    async save(result: RoastResult, ttlDays: number) {
      const expiresAt = Date.now() + ttlDays * 24 * 60 * 60 * 1000;
      map.set(result.id, { result, expiresAt });
    },

    async get(id: string) {
      const entry = map.get(id);
      if (!entry) return null;
      if (entry.expiresAt <= Date.now()) {
        map.delete(id);
        return null;
      }
      return entry.result;
    },
  };
}
