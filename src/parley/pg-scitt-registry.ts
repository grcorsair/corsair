/**
 * PgSCITTRegistry - Postgres-backed SCITT Transparency Log
 *
 * Implements the SCITTRegistry interface with real Merkle tree hashing,
 * COSE_Sign1 receipts, and Postgres persistence.
 *
 * Each registration:
 * 1. Hashes the statement with SHA-256
 * 2. Computes the new Merkle tree root
 * 3. Inserts into scitt_entries
 * 4. Generates a COSE_Sign1 receipt
 * 5. Inserts into scitt_receipts
 */

import * as crypto from "crypto";
import type {
  SCITTReceipt,
  SCITTRegistration,
  SCITTRegistry,
  SCITTListEntry,
  SCITTListOptions,
  SCITTProvenance,
  IssuerProfile,
} from "./scitt-types";
import { computeLeafHash, computeRootHash } from "./merkle";
import { coseSign1, coseVerify1 } from "./cose";

interface DbLike {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
}

export class PgSCITTRegistry implements SCITTRegistry {
  private db: DbLike;
  private signingKeyPem: string;
  private logId: string;

  constructor(db: DbLike, signingKeyPem: string, logId: string = "corsair-scitt-log") {
    this.db = db;
    this.signingKeyPem = signingKeyPem;
    this.logId = logId;
  }

  async register(statement: string, options?: { proofOnly?: boolean }): Promise<SCITTRegistration> {
    const entryId = `entry-${crypto.randomUUID()}`;
    const registrationTime = new Date().toISOString();

    // Hash the statement (always computed from the full statement for Merkle integrity)
    const statementHash = crypto.createHash("sha256").update(statement).digest("hex");

    // Get current tree size
    const maxRows = (await this.db`
      SELECT COALESCE(MAX(tree_size), 0) as max FROM scitt_entries
    `) as Array<{ max: number }>;
    const currentTreeSize = maxRows[0]?.max ?? 0;
    const newTreeSize = currentTreeSize + 1;

    // Get all existing leaf hashes for Merkle root computation
    const existingRows = (await this.db`
      SELECT statement_hash FROM scitt_entries ORDER BY tree_size ASC
    `) as Array<{ statement_hash: string }>;

    const allLeafHashes = [...existingRows.map((r) => r.statement_hash), statementHash];

    // Compute new tree hash
    const treeHash = computeRootHash(allLeafHashes.map((h) => computeLeafHash(h)));

    // Get parent hash (previous tree hash)
    const parentHash = existingRows.length > 0
      ? computeRootHash(existingRows.map((r) => computeLeafHash(r.statement_hash)))
      : null;

    // In proofOnly mode, store null instead of the full JWT statement
    const storedStatement = options?.proofOnly ? null : statement;

    // Insert entry
    await this.db`
      INSERT INTO scitt_entries (entry_id, statement, statement_hash, tree_size, tree_hash, parent_hash, registration_time)
      VALUES (${entryId}, ${storedStatement}, ${statementHash}, ${newTreeSize}, ${treeHash}, ${parentHash}, ${registrationTime}::timestamptz)
    `;

    // Generate COSE_Sign1 receipt
    const receiptPayload = JSON.stringify({
      logId: this.logId,
      entryId,
      treeSize: newTreeSize,
      treeHash,
      statementHash,
      registrationTime,
    });
    const coseBytes = coseSign1(Buffer.from(receiptPayload), this.signingKeyPem);
    const proofBase64 = coseBytes.toString("base64");

    // Insert receipt
    await this.db`
      INSERT INTO scitt_receipts (entry_id, log_id, proof, issued_at)
      VALUES (${entryId}, ${this.logId}, ${proofBase64}, ${registrationTime}::timestamptz)
    `;

    return {
      entryId,
      registrationTime,
      status: "registered",
    };
  }

  async getReceipt(entryId: string): Promise<SCITTReceipt | null> {
    const rows = (await this.db`
      SELECT entry_id, log_id, proof, issued_at
      FROM scitt_receipts
      WHERE entry_id = ${entryId}
    `) as Array<{
      entry_id: string;
      log_id: string;
      proof: string;
      issued_at: string;
    }>;

    if (rows.length === 0) return null;

    const row = rows[0]!;
    return {
      entryId: row.entry_id,
      registrationTime: row.issued_at,
      logId: row.log_id,
      proof: row.proof,
    };
  }

  /**
   * Verify a receipt's COSE_Sign1 signature using the given public key.
   * Returns true if the receipt exists and its signature is valid.
   */
  async verifyReceipt(entryId: string, publicKeyPem: string): Promise<boolean> {
    const receipt = await this.getReceipt(entryId);
    if (!receipt) return false;

    try {
      const coseBytes = Buffer.from(receipt.proof, "base64");
      const result = coseVerify1(coseBytes, publicKeyPem);
      return result.verified;
    } catch {
      return false;
    }
  }

  /**
   * List SCITT entries with decoded JWT metadata.
   * Ordered by registration time descending (newest first).
   */
  async listEntries(options: SCITTListOptions = {}): Promise<SCITTListEntry[]> {
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;

    const rows = (await this.db`
      SELECT entry_id, statement, tree_size, registration_time
      FROM scitt_entries
      ORDER BY registration_time DESC
      LIMIT ${limit + (options.issuer || options.framework ? 100 : 0)}
      OFFSET ${options.issuer || options.framework ? 0 : offset}
    `) as Array<{
      entry_id: string;
      statement: string | null;
      tree_size: number;
      registration_time: string;
    }>;

    let entries: SCITTListEntry[] = [];

    for (const row of rows) {
      // Proof-only entries have null statement -- use defaults for metadata
      if (row.statement === null) {
        const entry: SCITTListEntry = {
          entryId: row.entry_id,
          registrationTime: row.registration_time,
          treeSize: row.tree_size,
          issuer: "unknown",
          scope: "unknown",
          provenance: { source: "unknown" },
          proofOnly: true,
        };

        // Proof-only entries cannot be filtered by issuer or framework
        if (options.issuer || options.framework) continue;

        entries.push(entry);
        continue;
      }

      const payload = decodeJWTPayload(row.statement);
      const vc = payload.vc as Record<string, unknown> | undefined;
      const subject = vc?.credentialSubject as Record<string, unknown> | undefined;

      const issuer = (payload.iss as string) || "unknown";
      const scope = (subject?.scope as string) || "unknown";
      const provenanceRaw = subject?.provenance as Record<string, unknown> | undefined;
      const summary = subject?.summary as SCITTListEntry["summary"] | undefined;
      const frameworks = subject?.frameworks as Record<string, unknown> | undefined;

      // Apply issuer filter
      if (options.issuer && issuer !== options.issuer) continue;

      // Apply framework filter
      if (options.framework && frameworks) {
        if (!Object.keys(frameworks).includes(options.framework)) continue;
      } else if (options.framework && !frameworks) {
        continue;
      }

      // Extract provenance (primary signal)
      const provenance: SCITTProvenance = {
        source: (provenanceRaw?.source as SCITTProvenance["source"]) || "unknown",
        ...(provenanceRaw?.sourceIdentity ? { sourceIdentity: provenanceRaw.sourceIdentity as string } : {}),
      };

      const entry: SCITTListEntry = {
        entryId: row.entry_id,
        registrationTime: row.registration_time,
        treeSize: row.tree_size,
        issuer,
        scope,
        provenance,
      };

      if (summary) {
        entry.summary = summary;
      }

      entries.push(entry);
    }

    // Apply offset/limit for filtered queries
    if (options.issuer || options.framework) {
      entries = entries.slice(offset, offset + limit);
    }

    return entries;
  }

  /**
   * Get aggregated profile for a CPOE issuer.
   * Returns null if no entries exist for the given issuer DID.
   */
  async getIssuerProfile(issuerDID: string): Promise<IssuerProfile | null> {
    const rows = (await this.db`
      SELECT entry_id, statement, registration_time
      FROM scitt_entries
    `) as Array<{
      entry_id: string;
      statement: string | null;
      registration_time: string;
    }>;

    const issuerEntries: Array<{
      entryId: string;
      registrationTime: string;
      scope: string;
      score: number;
      provenance: SCITTProvenance;
      frameworks: string[];
    }> = [];

    for (const row of rows) {
      // Skip proof-only entries (no statement to decode, cannot match issuer)
      if (row.statement === null) continue;

      const payload = decodeJWTPayload(row.statement);
      const iss = payload.iss as string | undefined;
      if (iss !== issuerDID) continue;

      const vc = payload.vc as Record<string, unknown> | undefined;
      const subject = vc?.credentialSubject as Record<string, unknown> | undefined;
      const provenanceRaw = subject?.provenance as Record<string, unknown> | undefined;
      const summary = subject?.summary as Record<string, unknown> | undefined;
      const frameworks = subject?.frameworks as Record<string, unknown> | undefined;

      const provenance: SCITTProvenance = {
        source: (provenanceRaw?.source as SCITTProvenance["source"]) || "unknown",
        ...(provenanceRaw?.sourceIdentity ? { sourceIdentity: provenanceRaw.sourceIdentity as string } : {}),
      };

      issuerEntries.push({
        entryId: row.entry_id,
        registrationTime: row.registration_time,
        scope: (subject?.scope as string) || "unknown",
        score: (summary?.overallScore as number) || 0,
        provenance,
        frameworks: frameworks ? Object.keys(frameworks) : [],
      });
    }

    if (issuerEntries.length === 0) return null;

    // Sort by registration time descending
    issuerEntries.sort(
      (a, b) => new Date(b.registrationTime).getTime() - new Date(a.registrationTime).getTime()
    );

    // Aggregate
    const allFrameworks = new Set<string>();
    let totalScore = 0;
    const provenanceSummary = { self: 0, tool: 0, auditor: 0 };
    for (const entry of issuerEntries) {
      totalScore += entry.score;
      // Aggregate provenance (primary signal)
      const src = entry.provenance.source;
      if (src === "self" || src === "tool" || src === "auditor") {
        provenanceSummary[src]++;
      }
      for (const fw of entry.frameworks) allFrameworks.add(fw);
    }

    return {
      issuerDID,
      totalCPOEs: issuerEntries.length,
      frameworks: Array.from(allFrameworks),
      averageScore: Math.round(totalScore / issuerEntries.length),
      provenanceSummary,
      lastCPOEDate: issuerEntries[0].registrationTime,
      history: issuerEntries.slice(0, 20).map((e) => ({
        entryId: e.entryId,
        registrationTime: e.registrationTime,
        scope: e.scope,
        score: e.score,
        provenance: e.provenance,
      })),
    };
  }
}

// =============================================================================
// JWT PAYLOAD DECODER (exported for reuse)
// =============================================================================

/**
 * Decode a JWT payload without cryptographic verification.
 * Splits by ".", base64url decodes the middle segment, JSON.parse.
 * Returns empty object on failure.
 */
export function decodeJWTPayload(jwt: string): Record<string, unknown> {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return {};
    const payload = Buffer.from(parts[1], "base64url").toString();
    return JSON.parse(payload);
  } catch {
    return {};
  }
}
