/**
 * CorsairClient SDK Tests — TDD Red Phase
 *
 * Tests the public API surface of @corsair/sdk.
 * Every method of CorsairClient is covered.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";

// SDK imports — will be implemented after tests are written
import { CorsairClient } from "../src/client";
import type {
  SignOptions,
  SignResult,
  VerifyResult,
  ScoreResult,
  QueryResult,
  CorsairClientConfig,
} from "../src/types";

// =============================================================================
// TEST FIXTURES
// =============================================================================

const FIXTURES_DIR = path.join(import.meta.dir, "fixtures");
const TEMP_KEY_DIR = path.join(import.meta.dir, ".test-keys-sdk");

// Sample Prowler evidence from the examples directory
const PROWLER_EVIDENCE_PATH = path.resolve(
  import.meta.dir,
  "../../../examples/prowler-findings.json",
);
const GENERIC_EVIDENCE_PATH = path.resolve(
  import.meta.dir,
  "../../../examples/generic-evidence.json",
);

let prowlerEvidence: unknown;
let genericEvidence: unknown;

beforeAll(() => {
  prowlerEvidence = JSON.parse(fs.readFileSync(PROWLER_EVIDENCE_PATH, "utf-8"));
  genericEvidence = JSON.parse(fs.readFileSync(GENERIC_EVIDENCE_PATH, "utf-8"));

  // Create temp key directory for tests
  fs.mkdirSync(TEMP_KEY_DIR, { recursive: true });
});

afterAll(() => {
  // Clean up temp key directory
  fs.rmSync(TEMP_KEY_DIR, { recursive: true, force: true });
});

// =============================================================================
// CONSTRUCTOR
// =============================================================================

describe("CorsairClient", () => {
  describe("constructor", () => {
    test("should create a client with default config", () => {
      const client = new CorsairClient();
      expect(client).toBeDefined();
    });

    test("should create a client with custom keyDir", () => {
      const client = new CorsairClient({ keyDir: TEMP_KEY_DIR });
      expect(client).toBeDefined();
    });

    test("should create a client with custom DID", () => {
      const client = new CorsairClient({ did: "did:web:acme.com" });
      expect(client).toBeDefined();
    });

    test("should accept all config options", () => {
      const client = new CorsairClient({
        keyDir: TEMP_KEY_DIR,
        did: "did:web:test.com",
      });
      expect(client).toBeDefined();
    });
  });

  // ===========================================================================
  // KEYGEN
  // ===========================================================================

  describe("keygen", () => {
    test("should generate an Ed25519 keypair", async () => {
      const client = new CorsairClient({ keyDir: TEMP_KEY_DIR });
      const result = await client.keygen();

      expect(result).toBeDefined();
      expect(result.publicKey).toBeString();
      expect(result.privateKey).toBeString();
      expect(result.publicKey).toContain("PUBLIC KEY");
      expect(result.privateKey).toContain("PRIVATE KEY");
    });

    test("should generate keypair to a specific directory", async () => {
      const customDir = path.join(TEMP_KEY_DIR, "custom-keygen");
      const client = new CorsairClient({ keyDir: TEMP_KEY_DIR });
      const result = await client.keygen(customDir);

      expect(result.publicKey).toContain("PUBLIC KEY");
      expect(result.privateKey).toContain("PRIVATE KEY");

      // Verify files were written
      expect(fs.existsSync(path.join(customDir, "corsair-signing.pub"))).toBe(true);
      expect(fs.existsSync(path.join(customDir, "corsair-signing.key"))).toBe(true);

      // Cleanup
      fs.rmSync(customDir, { recursive: true, force: true });
    });
  });

  // ===========================================================================
  // SIGN
  // ===========================================================================

  describe("sign", () => {
    let client: CorsairClient;

    beforeAll(async () => {
      client = new CorsairClient({ keyDir: TEMP_KEY_DIR });
      await client.keygen();
    });

    test("should sign Prowler evidence and return a SignResult", async () => {
      const result = await client.sign(prowlerEvidence);

      expect(result).toBeDefined();
      expect(result.jwt).toBeString();
      expect(result.jwt.length).toBeGreaterThan(0);
      expect(result.jwt.split(".")).toHaveLength(3);
      expect(result.marqueId).toMatch(/^marque-/);
      expect(result.detectedFormat).toBe("prowler");
    });

    test("should include summary in sign result", async () => {
      const result = await client.sign(prowlerEvidence);

      expect(result.summary).toBeDefined();
      expect(result.summary.controlsTested).toBeGreaterThan(0);
      expect(typeof result.summary.controlsPassed).toBe("number");
      expect(typeof result.summary.controlsFailed).toBe("number");
      expect(result.summary.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.summary.overallScore).toBeLessThanOrEqual(100);
    });

    test("should include provenance in sign result", async () => {
      const result = await client.sign(prowlerEvidence);

      expect(result.provenance).toBeDefined();
      expect(result.provenance.source).toBeString();
    });

    test("should sign with format override", async () => {
      const result = await client.sign(prowlerEvidence, { format: "prowler" });

      expect(result.detectedFormat).toBe("prowler");
      expect(result.jwt.length).toBeGreaterThan(0);
    });

    test("should sign generic evidence", async () => {
      const result = await client.sign(genericEvidence);

      expect(result.jwt).toBeString();
      expect(result.summary.controlsTested).toBeGreaterThan(0);
    });

    test("should sign string evidence (JSON string input)", async () => {
      const jsonString = JSON.stringify(prowlerEvidence);
      const result = await client.sign(jsonString);

      expect(result.jwt).toBeString();
      expect(result.jwt.split(".")).toHaveLength(3);
    });

    test("should support dry-run mode (no signing)", async () => {
      const result = await client.sign(prowlerEvidence, { dryRun: true });

      expect(result.jwt).toBe("");
      expect(result.marqueId).toMatch(/^marque-/);
      expect(result.summary.controlsTested).toBeGreaterThan(0);
    });

    test("should support custom DID override in sign options", async () => {
      const result = await client.sign(prowlerEvidence, {
        did: "did:web:custom.example.com",
      });

      expect(result.jwt).toBeString();
      expect(result.jwt.split(".")).toHaveLength(3);
    });

    test("should support custom scope override", async () => {
      const result = await client.sign(prowlerEvidence, {
        scope: "Custom SOC 2 Scope",
      });

      expect(result.jwt).toBeString();
    });

    test("should support custom expiry days", async () => {
      const result = await client.sign(prowlerEvidence, { expiryDays: 30 });

      expect(result.jwt).toBeString();
    });

    test("should return warnings array", async () => {
      const result = await client.sign(prowlerEvidence);

      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  // ===========================================================================
  // VERIFY
  // ===========================================================================

  describe("verify", () => {
    let client: CorsairClient;
    let signedJwt: string;

    beforeAll(async () => {
      client = new CorsairClient({ keyDir: TEMP_KEY_DIR });
      // Ensure keys exist
      const keys = await client.keygen();
      const signResult = await client.sign(prowlerEvidence);
      signedJwt = signResult.jwt;
    });

    test("should verify a valid CPOE", async () => {
      const result = await client.verify(signedJwt);

      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
    });

    test("should return metadata for a valid CPOE", async () => {
      const result = await client.verify(signedJwt);

      expect(result.signedBy).toBeString();
      expect(result.generatedAt).toBeString();
      expect(result.expiresAt).toBeString();
    });

    test("should return provenance for a valid CPOE", async () => {
      const result = await client.verify(signedJwt);

      expect(result.provenance).toBeDefined();
    });

    test("should return summary for a valid CPOE", async () => {
      const result = await client.verify(signedJwt);

      expect(result.summary).toBeDefined();
    });

    test("should reject a tampered CPOE", async () => {
      const tampered = signedJwt.slice(0, -5) + "XXXXX";
      const result = await client.verify(tampered);

      expect(result.valid).toBe(false);
    });

    test("should reject invalid JWT format", async () => {
      const result = await client.verify("not-a-jwt");

      expect(result.valid).toBe(false);
    });
  });

  // ===========================================================================
  // SCORE
  // ===========================================================================

  describe("score", () => {
    let client: CorsairClient;

    beforeAll(async () => {
      client = new CorsairClient({ keyDir: TEMP_KEY_DIR });
    });

    test("should score Prowler evidence", async () => {
      const result = await client.score(prowlerEvidence);

      expect(result).toBeDefined();
      expect(typeof result.composite).toBe("number");
      expect(result.composite).toBeGreaterThanOrEqual(0);
      expect(result.composite).toBeLessThanOrEqual(100);
    });

    test("should return a letter grade", async () => {
      const result = await client.score(prowlerEvidence);

      expect(["A", "B", "C", "D", "F"]).toContain(result.grade);
    });

    test("should return 7 dimensions", async () => {
      const result = await client.score(prowlerEvidence);

      expect(result.dimensions).toHaveLength(7);
    });

    test("should include dimension details", async () => {
      const result = await client.score(prowlerEvidence);

      for (const dim of result.dimensions) {
        expect(dim.name).toBeString();
        expect(typeof dim.score).toBe("number");
        expect(typeof dim.weight).toBe("number");
        expect(typeof dim.weighted).toBe("number");
        expect(["deterministic", "model-assisted"]).toContain(dim.method);
        expect(dim.detail).toBeString();
      }
    });

    test("should include controlsScored count", async () => {
      const result = await client.score(prowlerEvidence);

      expect(result.controlsScored).toBeGreaterThan(0);
    });

    test("should include scoredAt timestamp", async () => {
      const result = await client.score(prowlerEvidence);

      expect(result.scoredAt).toBeString();
      // Should be a valid ISO date
      expect(new Date(result.scoredAt).getTime()).not.toBeNaN();
    });

    test("should score generic evidence", async () => {
      const result = await client.score(genericEvidence);

      expect(result.composite).toBeGreaterThanOrEqual(0);
      expect(result.controlsScored).toBeGreaterThan(0);
    });

    test("should accept format override for scoring", async () => {
      const result = await client.score(prowlerEvidence, { format: "prowler" });

      expect(result.composite).toBeGreaterThanOrEqual(0);
    });

    test("should return empty score for empty controls", async () => {
      const emptyEvidence = { metadata: { title: "empty", issuer: "test", date: "2026-01-01", scope: "none" }, controls: [] };
      const result = await client.score(emptyEvidence);

      expect(result.composite).toBe(0);
      expect(result.grade).toBe("F");
      expect(result.controlsScored).toBe(0);
    });
  });

  // ===========================================================================
  // QUERY
  // ===========================================================================

  describe("query", () => {
    let client: CorsairClient;

    beforeAll(async () => {
      client = new CorsairClient({ keyDir: TEMP_KEY_DIR });
    });

    test("should query controls with no filters (return all)", async () => {
      const result = await client.query(prowlerEvidence);

      expect(result).toBeDefined();
      expect(result.controls.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
    });

    test("should filter by status=fail", async () => {
      const result = await client.query(prowlerEvidence, { status: "fail" });

      expect(result.controls.length).toBeGreaterThan(0);
      for (const ctrl of result.controls) {
        expect(ctrl.status).toBe("fail");
      }
    });

    test("should filter by severity", async () => {
      const result = await client.query(prowlerEvidence, { severity: "critical" });

      for (const ctrl of result.controls) {
        expect(ctrl.severity).toBe("critical");
      }
    });

    test("should return aggregations", async () => {
      const result = await client.query(prowlerEvidence);

      expect(result.aggregations).toBeDefined();
      expect(result.aggregations.byStatus).toBeDefined();
      expect(result.aggregations.bySeverity).toBeDefined();
      expect(result.aggregations.byFramework).toBeDefined();
    });

    test("should support pagination with limit", async () => {
      const result = await client.query(prowlerEvidence, { limit: 3 });

      expect(result.controls.length).toBeLessThanOrEqual(3);
      expect(result.total).toBeGreaterThan(3);
    });

    test("should support text search", async () => {
      const result = await client.query(prowlerEvidence, { search: "MFA" });

      expect(result.controls.length).toBeGreaterThan(0);
    });

    test("should sort by severity", async () => {
      const result = await client.query(prowlerEvidence, {
        sortBy: "severity",
        sortDirection: "asc",
      });

      expect(result.controls.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // FORMATS
  // ===========================================================================

  describe("formats", () => {
    test("should return supported format list", () => {
      const client = new CorsairClient();
      const formats = client.formats();

      expect(Array.isArray(formats)).toBe(true);
      expect(formats.length).toBeGreaterThan(0);
      expect(formats).toContain("prowler");
      expect(formats).toContain("generic");
      expect(formats).toContain("inspec");
      expect(formats).toContain("trivy");
      expect(formats).toContain("securityhub");
      expect(formats).toContain("gitlab");
      expect(formats).toContain("ciso-assistant-api");
      expect(formats).toContain("ciso-assistant-export");
    });
  });

  // ===========================================================================
  // TYPE RE-EXPORTS
  // ===========================================================================

  describe("type re-exports", () => {
    test("should export CorsairClient from index", async () => {
      const { CorsairClient: IndexClient } = await import("../src/index");
      expect(IndexClient).toBeDefined();
      const client = new IndexClient();
      expect(client).toBeDefined();
    });
  });
});
