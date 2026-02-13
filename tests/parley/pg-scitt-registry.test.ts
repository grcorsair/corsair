/**
 * PgSCITTRegistry Tests — listEntries() and getIssuerProfile()
 *
 * Tests the Postgres-backed SCITT registry extensions for
 * browsing the transparency log and viewing issuer profiles.
 */

import { describe, test, expect } from "bun:test";
import { PgSCITTRegistry } from "../../src/parley/pg-scitt-registry";
import type {
  SCITTListEntry,
  SCITTListOptions,
  IssuerProfile,
} from "../../src/parley/scitt-types";

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
// HELPERS: Mock database
// =============================================================================

/**
 * Creates a mock Postgres DB function that stores rows in-memory.
 * Supports the SQL queries used by PgSCITTRegistry.
 */
function createMockDb() {
  const entries: Array<{
    entry_id: string;
    statement: string;
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
        statement: values[1] as string,
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

    // SELECT FROM scitt_entries (all — for getIssuerProfile)
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
// decodeJWTPayload helper
// =============================================================================

describe("decodeJWTPayload", () => {
  test("is exported from pg-scitt-registry", async () => {
    const mod = await import("../../src/parley/pg-scitt-registry");
    expect(mod.decodeJWTPayload).toBeDefined();
    expect(typeof mod.decodeJWTPayload).toBe("function");
  });

  test("decodes a valid JWT payload", async () => {
    const { decodeJWTPayload } = await import("../../src/parley/pg-scitt-registry");
    const jwt = buildMockJWT({ iss: "did:web:test.com", scope: "Test" });
    const payload = decodeJWTPayload(jwt);
    expect(payload).not.toBeNull();
    expect(payload!.iss).toBe("did:web:test.com");
    expect((payload!.vc as any).credentialSubject.scope).toBe("Test");
  });

  test("returns empty object for invalid JWT", async () => {
    const { decodeJWTPayload } = await import("../../src/parley/pg-scitt-registry");
    const result = decodeJWTPayload("not-a-jwt");
    expect(result).toEqual({});
  });

  test("returns empty object for malformed base64", async () => {
    const { decodeJWTPayload } = await import("../../src/parley/pg-scitt-registry");
    const result = decodeJWTPayload("a.!!!invalid!!!.c");
    expect(result).toEqual({});
  });
});

// =============================================================================
// listEntries
// =============================================================================

describe("PgSCITTRegistry.listEntries", () => {
  test("method exists on PgSCITTRegistry", () => {
    const { db } = createMockDb();
    const registry = new PgSCITTRegistry(db, testSigningKey());
    expect(typeof registry.listEntries).toBe("function");
  });

  test("returns empty array when no entries exist", async () => {
    const { db } = createMockDb();
    const registry = new PgSCITTRegistry(db, testSigningKey());
    const result = await registry.listEntries();
    expect(result).toEqual([]);
  });

  test("returns entries with decoded JWT metadata including provenance", async () => {
    const { db } = createMockDb();
    const signingKey = testSigningKey();
    const registry = new PgSCITTRegistry(db, signingKey);

    const jwt = buildMockJWT({
      iss: "did:web:acme.com",
      scope: "AWS Production",
      provenance: { source: "tool", sourceIdentity: "Prowler v3.1" },
      assurance: { declared: 1 },
      summary: { controlsTested: 10, controlsPassed: 8, controlsFailed: 2, overallScore: 80 },
    });

    await registry.register(jwt);
    const entries = await registry.listEntries();

    expect(entries.length).toBe(1);
    expect(entries[0].entryId).toBeDefined();
    expect(entries[0].issuer).toBe("did:web:acme.com");
    expect(entries[0].scope).toBe("AWS Production");
    expect(entries[0].provenance).toEqual({ source: "tool", sourceIdentity: "Prowler v3.1" });
    expect(entries[0].assuranceLevel).toBe(1);
    expect(entries[0].summary).toEqual({
      controlsTested: 10,
      controlsPassed: 8,
      controlsFailed: 2,
      overallScore: 80,
    });
  });

  test("respects limit option", async () => {
    const { db } = createMockDb();
    const signingKey = testSigningKey();
    const registry = new PgSCITTRegistry(db, signingKey);

    for (let i = 0; i < 5; i++) {
      const jwt = buildMockJWT({ iss: `did:web:vendor-${i}.com`, scope: `Scope ${i}` });
      await registry.register(jwt);
    }

    const entries = await registry.listEntries({ limit: 3 });
    expect(entries.length).toBe(3);
  });

  test("respects offset option", async () => {
    const { db } = createMockDb();
    const signingKey = testSigningKey();
    const registry = new PgSCITTRegistry(db, signingKey);

    for (let i = 0; i < 5; i++) {
      const jwt = buildMockJWT({ iss: `did:web:vendor-${i}.com`, scope: `Scope ${i}` });
      await registry.register(jwt);
    }

    const all = await registry.listEntries();
    const offset = await registry.listEntries({ offset: 2 });
    expect(offset.length).toBe(3);
    expect(offset[0].entryId).toBe(all[2].entryId);
  });

  test("filters by issuer DID", async () => {
    const { db } = createMockDb();
    const signingKey = testSigningKey();
    const registry = new PgSCITTRegistry(db, signingKey);

    await registry.register(buildMockJWT({ iss: "did:web:acme.com", scope: "A" }));
    await registry.register(buildMockJWT({ iss: "did:web:other.com", scope: "B" }));
    await registry.register(buildMockJWT({ iss: "did:web:acme.com", scope: "C" }));

    const entries = await registry.listEntries({ issuer: "did:web:acme.com" });
    expect(entries.length).toBe(2);
    for (const e of entries) {
      expect(e.issuer).toBe("did:web:acme.com");
    }
  });

  test("filters by framework", async () => {
    const { db } = createMockDb();
    const signingKey = testSigningKey();
    const registry = new PgSCITTRegistry(db, signingKey);

    await registry.register(buildMockJWT({
      iss: "did:web:a.com",
      scope: "SOC 2",
      frameworks: { "SOC2": { controlsMapped: 5 } },
    }));
    await registry.register(buildMockJWT({
      iss: "did:web:b.com",
      scope: "NIST",
      frameworks: { "NIST-800-53": { controlsMapped: 3 } },
    }));

    const entries = await registry.listEntries({ framework: "SOC2" });
    expect(entries.length).toBe(1);
    expect(entries[0].scope).toBe("SOC 2");
  });

  test("defaults to limit 20", async () => {
    const { db } = createMockDb();
    const signingKey = testSigningKey();
    const registry = new PgSCITTRegistry(db, signingKey);

    for (let i = 0; i < 25; i++) {
      await registry.register(buildMockJWT({ iss: "did:web:bulk.com", scope: `Scope ${i}` }));
    }

    const entries = await registry.listEntries();
    expect(entries.length).toBe(20);
  });

  test("handles entries with missing assurance and provenance gracefully", async () => {
    const { db } = createMockDb();
    const signingKey = testSigningKey();
    const registry = new PgSCITTRegistry(db, signingKey);

    // JWT without assurance or provenance fields
    await registry.register(buildMockJWT({ iss: "did:web:minimal.com", scope: "Minimal" }));

    const entries = await registry.listEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].provenance).toEqual({ source: "unknown" });
    expect(entries[0].assuranceLevel).toBeUndefined();
  });
});

// =============================================================================
// getIssuerProfile
// =============================================================================

describe("PgSCITTRegistry.getIssuerProfile", () => {
  test("method exists on PgSCITTRegistry", () => {
    const { db } = createMockDb();
    const registry = new PgSCITTRegistry(db, testSigningKey());
    expect(typeof registry.getIssuerProfile).toBe("function");
  });

  test("returns null when no entries exist for issuer", async () => {
    const { db } = createMockDb();
    const registry = new PgSCITTRegistry(db, testSigningKey());
    const profile = await registry.getIssuerProfile("did:web:unknown.com");
    expect(profile).toBeNull();
  });

  test("returns profile with correct aggregate data including provenance", async () => {
    const { db } = createMockDb();
    const signingKey = testSigningKey();
    const registry = new PgSCITTRegistry(db, signingKey);

    await registry.register(buildMockJWT({
      iss: "did:web:acme.com",
      scope: "SOC 2",
      provenance: { source: "tool", sourceIdentity: "Prowler v3.1" },
      assurance: { declared: 1 },
      summary: { controlsTested: 10, controlsPassed: 8, controlsFailed: 2, overallScore: 80 },
      frameworks: { "SOC2": { controlsMapped: 10 } },
    }));

    await registry.register(buildMockJWT({
      iss: "did:web:acme.com",
      scope: "NIST",
      provenance: { source: "auditor", sourceIdentity: "Deloitte LLP" },
      assurance: { declared: 2 },
      summary: { controlsTested: 20, controlsPassed: 18, controlsFailed: 2, overallScore: 90 },
      frameworks: { "NIST-800-53": { controlsMapped: 20 } },
    }));

    // Also add an entry from a different issuer (should be excluded)
    await registry.register(buildMockJWT({
      iss: "did:web:other.com",
      scope: "Other",
      provenance: { source: "self" },
      assurance: { declared: 3 },
      summary: { controlsTested: 5, controlsPassed: 5, controlsFailed: 0, overallScore: 100 },
    }));

    const profile = await registry.getIssuerProfile("did:web:acme.com");

    expect(profile).not.toBeNull();
    expect(profile!.issuerDID).toBe("did:web:acme.com");
    expect(profile!.totalCPOEs).toBe(2);
    expect(profile!.frameworks).toContain("SOC2");
    expect(profile!.frameworks).toContain("NIST-800-53");
    expect(profile!.averageScore).toBe(85); // (80 + 90) / 2
    expect(profile!.provenanceSummary).toEqual({ self: 0, tool: 1, auditor: 1 });
    expect(profile!.currentAssuranceLevel).toBe(2); // max
    expect(profile!.history.length).toBe(2);
    // History entries include provenance
    expect(profile!.history[0].provenance.source).toBeDefined();
  });

  test("history is limited to 20 entries", async () => {
    const { db } = createMockDb();
    const signingKey = testSigningKey();
    const registry = new PgSCITTRegistry(db, signingKey);

    for (let i = 0; i < 25; i++) {
      await registry.register(buildMockJWT({
        iss: "did:web:prolific.com",
        scope: `Assessment ${i}`,
        assurance: { declared: 1 },
        summary: { controlsTested: 10, controlsPassed: 10, controlsFailed: 0, overallScore: 100 },
      }));
    }

    const profile = await registry.getIssuerProfile("did:web:prolific.com");
    expect(profile).not.toBeNull();
    expect(profile!.totalCPOEs).toBe(25);
    expect(profile!.history.length).toBe(20);
  });

  test("lastCPOEDate is the most recent registration time", async () => {
    const { db } = createMockDb();
    const signingKey = testSigningKey();
    const registry = new PgSCITTRegistry(db, signingKey);

    await registry.register(buildMockJWT({
      iss: "did:web:acme.com",
      scope: "First",
      assurance: { declared: 1 },
      summary: { controlsTested: 5, controlsPassed: 5, controlsFailed: 0, overallScore: 100 },
    }));

    // Small delay to ensure different timestamps
    await new Promise(r => setTimeout(r, 10));

    await registry.register(buildMockJWT({
      iss: "did:web:acme.com",
      scope: "Second",
      assurance: { declared: 2 },
      summary: { controlsTested: 10, controlsPassed: 9, controlsFailed: 1, overallScore: 90 },
    }));

    const profile = await registry.getIssuerProfile("did:web:acme.com");
    expect(profile).not.toBeNull();
    // lastCPOEDate should be a valid ISO timestamp
    expect(new Date(profile!.lastCPOEDate).getTime()).toBeGreaterThan(0);
  });

  test("handles entries with no assurance, provenance, or summary", async () => {
    const { db } = createMockDb();
    const signingKey = testSigningKey();
    const registry = new PgSCITTRegistry(db, signingKey);

    await registry.register(buildMockJWT({
      iss: "did:web:minimal.com",
      scope: "Minimal Assessment",
    }));

    const profile = await registry.getIssuerProfile("did:web:minimal.com");
    expect(profile).not.toBeNull();
    expect(profile!.totalCPOEs).toBe(1);
    expect(profile!.averageScore).toBe(0);
    expect(profile!.provenanceSummary).toEqual({ self: 0, tool: 0, auditor: 0 });
    expect(profile!.currentAssuranceLevel).toBeUndefined();
  });
});
