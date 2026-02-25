import { createHash } from "crypto";
import type { TrustTxt } from "./trust-txt";
import type { DatabaseLike } from "../db/migrate";

export type HostedTrustTxtStatus = "pending" | "active" | "revoked";
export type HostedTrustTxtOwnerType = "api_key" | "oidc";

export interface HostedTrustTxtRecord {
  domain: string;
  did: string;
  config: TrustTxt;
  trustTxt: string;
  trustTxtHash: string;
  ownerType: HostedTrustTxtOwnerType;
  ownerId: string;
  status: HostedTrustTxtStatus;
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string | null;
}

export interface HostedTrustTxtStore {
  get(domain: string): Promise<HostedTrustTxtRecord | null>;
  upsert(
    record: Omit<HostedTrustTxtRecord, "createdAt" | "updatedAt"> & {
      createdAt?: string;
      updatedAt?: string;
    },
  ): Promise<HostedTrustTxtRecord>;
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

function normalizeConfig(input: unknown): TrustTxt {
  if (typeof input === "string") {
    try {
      return JSON.parse(input) as TrustTxt;
    } catch {
      return { cpoes: [], frameworks: [] };
    }
  }
  if (input && typeof input === "object") {
    return input as TrustTxt;
  }
  return { cpoes: [], frameworks: [] };
}

function normalizeRecord(row: Record<string, unknown>): HostedTrustTxtRecord {
  return {
    domain: String(row.domain || ""),
    did: String(row.did || ""),
    config: normalizeConfig(row.config),
    trustTxt: String(row.trust_txt || ""),
    trustTxtHash: String(row.trust_txt_hash || ""),
    ownerType: (row.owner_type || "api_key") as HostedTrustTxtOwnerType,
    ownerId: String(row.owner_id || ""),
    status: (row.status || "pending") as HostedTrustTxtStatus,
    createdAt: toIso(row.created_at) || new Date().toISOString(),
    updatedAt: toIso(row.updated_at) || new Date().toISOString(),
    verifiedAt: toIso(row.verified_at),
  };
}

export function createHostedTrustTxtStore(db: DatabaseLike): HostedTrustTxtStore {
  return {
    async get(domain: string) {
      const rows = await db`
        SELECT domain, did, config, trust_txt, trust_txt_hash, owner_type, owner_id,
               status, created_at, updated_at, verified_at
        FROM hosted_trust_txt
        WHERE domain = ${domain}
      `;
      if (!rows || rows.length === 0) return null;
      return normalizeRecord(rows[0] as Record<string, unknown>);
    },
    async upsert(record) {
      const createdAt = record.createdAt || new Date().toISOString();
      const updatedAt = record.updatedAt || new Date().toISOString();
      const rows = await db`
        INSERT INTO hosted_trust_txt (
          domain, did, config, trust_txt, trust_txt_hash,
          owner_type, owner_id, status, created_at, updated_at, verified_at
        ) VALUES (
          ${record.domain}, ${record.did}, ${JSON.stringify(record.config)},
          ${record.trustTxt}, ${record.trustTxtHash},
          ${record.ownerType}, ${record.ownerId}, ${record.status},
          ${createdAt}, ${updatedAt},
          ${record.verifiedAt || null}
        )
        ON CONFLICT (domain) DO UPDATE SET
          did = EXCLUDED.did,
          config = EXCLUDED.config,
          trust_txt = EXCLUDED.trust_txt,
          trust_txt_hash = EXCLUDED.trust_txt_hash,
          owner_type = EXCLUDED.owner_type,
          owner_id = EXCLUDED.owner_id,
          status = EXCLUDED.status,
          updated_at = EXCLUDED.updated_at,
          verified_at = EXCLUDED.verified_at,
          created_at = hosted_trust_txt.created_at
        RETURNING domain, did, config, trust_txt, trust_txt_hash, owner_type, owner_id,
                  status, created_at, updated_at, verified_at
      `;

      return normalizeRecord(rows[0] as Record<string, unknown>);
    },
  };
}

export function createMemoryHostedTrustTxtStore(): HostedTrustTxtStore {
  const records = new Map<string, HostedTrustTxtRecord>();

  return {
    async get(domain: string) {
      return records.get(domain) || null;
    },
    async upsert(record) {
      const now = new Date().toISOString();
      const existing = records.get(record.domain);
      const createdAt = existing?.createdAt || record.createdAt || now;
      const next: HostedTrustTxtRecord = {
        ...record,
        createdAt,
        updatedAt: record.updatedAt || now,
      } as HostedTrustTxtRecord;
      records.set(record.domain, next);
      return next;
    },
  };
}

export function hashTrustTxt(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}
