/**
 * PgSCITTRegistry Tests
 *
 * Tests Postgres-backed SCITT transparency log with COSE receipts
 * and Merkle tree integrity. Uses a mock DB for isolation.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import * as crypto from "crypto";
import { PgSCITTRegistry } from "../../src/parley/pg-scitt-registry";
import { coseVerify1 } from "../../src/parley/cose";

// =============================================================================
// Ed25519 KEY GENERATION
// =============================================================================

function generateEd25519Keypair(): { publicKeyPem: string; privateKeyPem: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKeyPem: publicKey, privateKeyPem: privateKey };
}

// =============================================================================
// MOCK DATABASE
// =============================================================================

interface MockRow {
  [key: string]: unknown;
}

function createMockDb() {
  const scittEntries: MockRow[] = [];
  const scittReceipts: MockRow[] = [];
  let treeSize = 0;

  const db = function (strings: TemplateStringsArray, ...values: unknown[]): Promise<MockRow[]> {
    const sql = strings.join("?");

    // SELECT MAX(tree_size)
    if (sql.includes("MAX") && sql.includes("tree_size")) {
      const max = scittEntries.length > 0
        ? Math.max(...scittEntries.map((e) => e.tree_size as number))
        : 0;
      return Promise.resolve([{ max: max }]);
    }

    // SELECT all entries (for tree hash computation)
    if (sql.includes("SELECT") && sql.includes("statement_hash") && sql.includes("ORDER BY tree_size")) {
      return Promise.resolve(scittEntries.map((e) => ({ statement_hash: e.statement_hash })));
    }

    // INSERT scitt_entries
    if (sql.includes("INSERT INTO scitt_entries")) {
      treeSize++;
      const row: MockRow = {
        entry_id: values[0],
        statement: values[1],
        statement_hash: values[2],
        tree_size: values[3],
        tree_hash: values[4],
        parent_hash: values[5] || null,
        registration_time: new Date().toISOString(),
      };
      scittEntries.push(row);
      return Promise.resolve([row]);
    }

    // INSERT scitt_receipts
    if (sql.includes("INSERT INTO scitt_receipts")) {
      const row: MockRow = {
        entry_id: values[0],
        log_id: values[1],
        proof: values[2],
        issued_at: new Date().toISOString(),
      };
      scittReceipts.push(row);
      return Promise.resolve([row]);
    }

    // SELECT scitt_entries by entry_id
    if (sql.includes("SELECT") && sql.includes("scitt_entries") && sql.includes("entry_id")) {
      const entryId = values[0] as string;
      const row = scittEntries.find((e) => e.entry_id === entryId);
      return Promise.resolve(row ? [row] : []);
    }

    // SELECT scitt_receipts by entry_id
    if (sql.includes("SELECT") && sql.includes("scitt_receipts") && sql.includes("entry_id")) {
      const entryId = values[0] as string;
      const row = scittReceipts.find((r) => r.entry_id === entryId);
      return Promise.resolve(row ? [row] : []);
    }

    return Promise.resolve([]);
  };

  return { db: db as any, scittEntries, scittReceipts };
}

describe("PgSCITTRegistry", () => {
  const keypair = generateEd25519Keypair();
  let mock: ReturnType<typeof createMockDb>;
  let registry: PgSCITTRegistry;

  beforeEach(() => {
    mock = createMockDb();
    registry = new PgSCITTRegistry(mock.db, keypair.privateKeyPem, "test-scitt-log");
  });

  // =========================================================================
  // REGISTER
  // =========================================================================
  describe("register", () => {
    test("registers a statement and returns registration", async () => {
      const registration = await registry.register("eyJhbGciOiJFZERTQSJ9.test-vc-jwt");

      expect(registration.entryId).toBeDefined();
      expect(registration.entryId.startsWith("entry-")).toBe(true);
      expect(registration.status).toBe("registered");
      expect(registration.registrationTime).toBeDefined();
    });

    test("increments tree size with each registration", async () => {
      await registry.register("statement-1");
      await registry.register("statement-2");

      expect(mock.scittEntries.length).toBe(2);
      expect(mock.scittEntries[0]!.tree_size).toBe(1);
      expect(mock.scittEntries[1]!.tree_size).toBe(2);
    });

    test("stores statement hash as SHA-256 hex", async () => {
      const statement = "test-statement";
      await registry.register(statement);

      const expectedHash = crypto.createHash("sha256").update(statement).digest("hex");
      expect(mock.scittEntries[0]!.statement_hash).toBe(expectedHash);
    });

    test("generates a COSE receipt on registration", async () => {
      const registration = await registry.register("test-statement");

      // A receipt should have been stored
      expect(mock.scittReceipts.length).toBe(1);
      expect(mock.scittReceipts[0]!.entry_id).toBe(registration.entryId);
      expect(mock.scittReceipts[0]!.log_id).toBe("test-scitt-log");
    });

    test("COSE receipt is verifiable with public key", async () => {
      await registry.register("test-statement");

      const proofBase64 = mock.scittReceipts[0]!.proof as string;
      const coseBytes = Buffer.from(proofBase64, "base64");
      const result = coseVerify1(coseBytes, keypair.publicKeyPem);

      expect(result.verified).toBe(true);
    });

    test("COSE receipt payload contains tree metadata", async () => {
      await registry.register("test-statement");

      const proofBase64 = mock.scittReceipts[0]!.proof as string;
      const coseBytes = Buffer.from(proofBase64, "base64");
      const result = coseVerify1(coseBytes, keypair.publicKeyPem);

      const payload = JSON.parse(result.payload.toString());
      expect(payload.logId).toBe("test-scitt-log");
      expect(payload.treeSize).toBe(1);
      expect(typeof payload.treeHash).toBe("string");
      expect(payload.treeHash.length).toBe(64); // SHA-256 hex
    });
  });

  // =========================================================================
  // GET RECEIPT
  // =========================================================================
  describe("getReceipt", () => {
    test("returns receipt for registered entry", async () => {
      const registration = await registry.register("test-statement");
      const receipt = await registry.getReceipt(registration.entryId);

      expect(receipt).not.toBeNull();
      expect(receipt!.entryId).toBe(registration.entryId);
      expect(receipt!.logId).toBe("test-scitt-log");
      expect(receipt!.proof).toBeDefined();
    });

    test("returns null for unknown entry", async () => {
      const receipt = await registry.getReceipt("entry-nonexistent");
      expect(receipt).toBeNull();
    });
  });

  // =========================================================================
  // VERIFY RECEIPT
  // =========================================================================
  describe("verifyReceipt", () => {
    test("verifies a valid receipt", async () => {
      const registration = await registry.register("test-statement");
      const verified = await registry.verifyReceipt(registration.entryId, keypair.publicKeyPem);

      expect(verified).toBe(true);
    });

    test("returns false for unknown entry", async () => {
      const verified = await registry.verifyReceipt("entry-nonexistent", keypair.publicKeyPem);
      expect(verified).toBe(false);
    });

    test("returns false with wrong public key", async () => {
      const otherKeypair = generateEd25519Keypair();
      const registration = await registry.register("test-statement");
      const verified = await registry.verifyReceipt(registration.entryId, otherKeypair.publicKeyPem);

      expect(verified).toBe(false);
    });
  });

  // =========================================================================
  // CHAIN INTEGRITY
  // =========================================================================
  describe("chain integrity", () => {
    test("multiple registrations maintain tree hash chain", async () => {
      await registry.register("statement-1");
      await registry.register("statement-2");
      await registry.register("statement-3");

      expect(mock.scittEntries.length).toBe(3);

      // Each entry should have a unique tree hash
      const hashes = mock.scittEntries.map((e) => e.tree_hash as string);
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(3);

      // All receipts should be verifiable
      for (const receipt of mock.scittReceipts) {
        const coseBytes = Buffer.from(receipt.proof as string, "base64");
        const result = coseVerify1(coseBytes, keypair.publicKeyPem);
        expect(result.verified).toBe(true);
      }
    });
  });
});
