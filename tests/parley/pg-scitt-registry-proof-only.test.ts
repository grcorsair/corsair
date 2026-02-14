/**
 * PgSCITTRegistry Tests — proofOnly mode
 *
 * Tests the proof-only SCITT registration mode where only the hash + COSE receipt
 * are stored, NOT the full JWT statement. This allows companies to prove a CPOE
 * was registered without exposing the credential itself.
 */

import { describe, test, expect } from "bun:test";
import { PgSCITTRegistry, decodeJWTPayload } from "../../src/parley/pg-scitt-registry";
import type { SCITTListEntry } from "../../src/parley/scitt-types";

// =============================================================================
// HELPERS: Build mock JWT-VCs for SCITT statement column
// =============================================================================

/** Build a minimal JWT-VC string (header.payload.signature) with given claims */
function buildMockJWT(claims: {
  iss: string;
  scope?: string;
  provenance?: { source: string; sourceIdentity?: string };
  assurance?: { declared: number };
  summary?: { controlsTested: number; controlsPassed: number; controlsFailed: number; overallScore: number };
  frameworks?: Record<string, unknown>;
}): string {
  const header = { alg: "EdDSA", typ: "vc+jwt", kid: `${claims.iss}#key-1` };
  const payload = {
    iss: claims.iss,
    sub: `marque-test-${Math.random().toString(36).slice(2)}`,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400,
    parley: "2.1",
    vc: {
      "@context": ["https://www.w3.org/ns/credentials/v2"],
      type: ["VerifiableCredential", "CorsairCPOE"],
      credentialSubject: {
        type: "CorsairCPOE",
        scope: claims.scope ?? "Test Scope",
        ...(claims.provenance ? { provenance: claims.provenance } : {}),
        ...(claims.assurance ? { assurance: claims.assurance } : {}),
        ...(claims.summary ? { summary: claims.summary } : {}),
        ...(claims.frameworks ? { frameworks: claims.frameworks } : {}),
      },
    },
  };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const fakeSig = Buffer.from("fake-signature").toString("base64url");
  return `${headerB64}.${payloadB64}.${fakeSig}`;
}

// =============================================================================
// HELPERS: Mock database (supports null statements for proofOnly mode)
// =============================================================================

/**
 * Creates a mock Postgres DB function that stores rows in-memory.
 * Supports null statement values for proofOnly mode.
 */
function createMockDb() {
  const entries: Array<{
    entry_id: string;
    statement: string | null;
    statement_hash: string;
    tree_size: number;
    tree_hash: string;
    parent_hash: string | null;
    registration_time: string;
  }> = [];

  const receipts: Array<{
    entry_id: string;
    log_id: string;
    proof: string;
    issued_at: string;
  }> = [];

  const db = (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]> => {
    const query = strings.join("?");

    // SELECT MAX(tree_size)
    if (query.includes("MAX(tree_size)")) {
      const max = entries.length > 0 ? Math.max(...entries.map(e => e.tree_size)) : 0;
      return Promise.resolve([{ max }]);
    }

    // SELECT statement_hash FROM scitt_entries ORDER BY tree_size
    if (query.includes("statement_hash") && query.includes("ORDER BY tree_size")) {
      return Promise.resolve(entries.map(e => ({ statement_hash: e.statement_hash })));
    }

    // INSERT INTO scitt_entries
    if (query.includes("INSERT INTO scitt_entries")) {
      entries.push({
        entry_id: values[0] as string,
        statement: values[1] as string | null,
        statement_hash: values[2] as string,
        tree_size: values[3] as number,
        tree_hash: values[4] as string,
        parent_hash: values[5] as string | null,
        registration_time: values[6] as string,
      });
      return Promise.resolve([]);
    }

    // INSERT INTO scitt_receipts
    if (query.includes("INSERT INTO scitt_receipts")) {
      receipts.push({
        entry_id: values[0] as string,
        log_id: values[1] as string,
        proof: values[2] as string,
        issued_at: values[3] as string,
      });
      return Promise.resolve([]);
    }

    // SELECT FROM scitt_receipts
    if (query.includes("FROM scitt_receipts")) {
      const entryId = values[0] as string;
      const found = receipts.filter(r => r.entry_id === entryId);
      return Promise.resolve(found);
    }

    // SELECT FROM scitt_entries ORDER BY registration_time DESC (listEntries)
    if (query.includes("FROM scitt_entries") && query.includes("ORDER BY registration_time")) {
      const limit = (values[0] as number) || 20;
      const offset = (values[1] as number) || 0;
      const sorted = [...entries].sort(
        (a, b) => new Date(b.registration_time).getTime() - new Date(a.registration_time).getTime()
      );
      return Promise.resolve(sorted.slice(offset, offset + limit));
    }

    // SELECT FROM scitt_entries (all -- for getIssuerProfile)
    if (query.includes("FROM scitt_entries")) {
      return Promise.resolve([...entries]);
    }

    return Promise.resolve([]);
  };

  return { db: db as any, entries, receipts };
}

// Generate a deterministic Ed25519 PEM for testing
function testSigningKey(): string {
  const crypto = require("crypto");
  const { privateKey } = crypto.generateKeyPairSync("ed25519", {
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  return privateKey;
}

// =============================================================================
// proofOnly registration mode
// =============================================================================

describe("PgSCITTRegistry proofOnly mode", () => {
  test("register() with proofOnly=true stores hash but NOT full statement", async () => {
    const { db, entries } = createMockDb();
    const signingKey = testSigningKey();
    const registry = new PgSCITTRegistry(db, signingKey);

    const jwt = buildMockJWT({
      iss: "did:web:acme.com",
      scope: "SOC 2 Type II",
      provenance: { source: "tool", sourceIdentity: "Prowler v3.1" },
    });

    const result = await registry.register(jwt, { proofOnly: true });

    expect(result.status).toBe("registered");
    expect(result.entryId).toBeDefined();

    // The DB entry should have null statement but valid statement_hash
    expect(entries.length).toBe(1);
    expect(entries[0].statement).toBeNull();
    expect(entries[0].statement_hash).toBeDefined();
    expect(entries[0].statement_hash.length).toBe(64); // SHA-256 hex = 64 chars
  });

  test("register() without proofOnly stores full statement (backward compat)", async () => {
    const { db, entries } = createMockDb();
    const signingKey = testSigningKey();
    const registry = new PgSCITTRegistry(db, signingKey);

    const jwt = buildMockJWT({
      iss: "did:web:acme.com",
      scope: "SOC 2 Type II",
    });

    await registry.register(jwt);

    // The DB entry should have the full statement
    expect(entries.length).toBe(1);
    expect(entries[0].statement).toBe(jwt);
    expect(entries[0].statement_hash).toBeDefined();
    expect(entries[0].statement_hash.length).toBe(64);
  });

  test("listEntries() returns proofOnly flag for proof-only entries", async () => {
    const { db } = createMockDb();
    const signingKey = testSigningKey();
    const registry = new PgSCITTRegistry(db, signingKey);

    // Register one normal entry
    await registry.register(buildMockJWT({
      iss: "did:web:acme.com",
      scope: "Full Statement",
    }));

    // Register one proof-only entry
    await registry.register(
      buildMockJWT({
        iss: "did:web:secret.com",
        scope: "Proof Only",
      }),
      { proofOnly: true }
    );

    const entries = await registry.listEntries();
    expect(entries.length).toBe(2);

    // Find the proof-only entry (statement is null, so issuer/scope will be defaults)
    const proofOnlyEntry = entries.find(e => e.proofOnly === true);
    expect(proofOnlyEntry).toBeDefined();
    expect(proofOnlyEntry!.proofOnly).toBe(true);

    // Find the full-statement entry
    const fullEntry = entries.find(e => e.issuer === "did:web:acme.com");
    expect(fullEntry).toBeDefined();
    expect(fullEntry!.proofOnly).toBeUndefined();
  });

  test("getReceipt() returns valid COSE receipt for proof-only entries", async () => {
    const { db } = createMockDb();
    const signingKey = testSigningKey();
    const registry = new PgSCITTRegistry(db, signingKey);

    const jwt = buildMockJWT({
      iss: "did:web:acme.com",
      scope: "Proof Only Receipt",
    });

    const result = await registry.register(jwt, { proofOnly: true });

    // Receipt should exist and have valid proof data
    const receipt = await registry.getReceipt(result.entryId);
    expect(receipt).not.toBeNull();
    expect(receipt!.entryId).toBe(result.entryId);
    expect(receipt!.proof).toBeDefined();
    expect(receipt!.proof.length).toBeGreaterThan(0);
    expect(receipt!.logId).toBe("corsair-scitt-log");
  });

  test("Merkle root computation unchanged for proof-only entries", async () => {
    const { db: db1, entries: entries1 } = createMockDb();
    const { db: db2, entries: entries2 } = createMockDb();
    const signingKey = testSigningKey();

    const registry1 = new PgSCITTRegistry(db1, signingKey);
    const registry2 = new PgSCITTRegistry(db2, signingKey);

    const jwt = buildMockJWT({
      iss: "did:web:acme.com",
      scope: "Merkle Test",
    });

    // Register same JWT with and without proofOnly
    await registry1.register(jwt);
    await registry2.register(jwt, { proofOnly: true });

    // Both should produce the same statement_hash (hash is computed from the JWT before storage decision)
    expect(entries1[0].statement_hash).toBe(entries2[0].statement_hash);

    // Both should produce the same tree_hash (Merkle uses statement_hash, not statement)
    expect(entries1[0].tree_hash).toBe(entries2[0].tree_hash);
  });
});
