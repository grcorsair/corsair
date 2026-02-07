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
import type { SCITTReceipt, SCITTRegistration, SCITTRegistry } from "./scitt-types";
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

  async register(statement: string): Promise<SCITTRegistration> {
    const entryId = `entry-${crypto.randomUUID()}`;
    const registrationTime = new Date().toISOString();

    // Hash the statement
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

    // Insert entry
    await this.db`
      INSERT INTO scitt_entries (entry_id, statement, statement_hash, tree_size, tree_hash, parent_hash, registration_time)
      VALUES (${entryId}, ${statement}, ${statementHash}, ${newTreeSize}, ${treeHash}, ${parentHash}, ${registrationTime}::timestamptz)
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
}
