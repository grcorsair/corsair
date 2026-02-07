/**
 * DID Document Hosting Test Contract
 *
 * Tests DID document generation via MarqueKeyManager, structure validation,
 * resolution roundtrip, domain encoding, and CLI script existence.
 */

import { describe, test, expect, afterAll } from "bun:test";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { MarqueKeyManager } from "../../src/parley/marque-key-manager";
import { resolveDIDDocument } from "../../src/parley/did-resolver";
import type { DIDDocument } from "../../src/parley/did-resolver";

describe("DID Document Hosting", () => {
  const testDirs: string[] = [];

  function createTestDir(): string {
    const dir = path.join(
      os.tmpdir(),
      `corsair-did-hosting-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );
    testDirs.push(dir);
    return dir;
  }

  afterAll(() => {
    for (const dir of testDirs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe("MarqueKeyManager.generateDIDDocument structure", () => {
    test("produces valid DID document for grcorsair.com", async () => {
      const keyDir = createTestDir();
      const manager = new MarqueKeyManager(keyDir);
      await manager.generateKeypair();

      const doc = await manager.generateDIDDocument("grcorsair.com");

      // Required @context
      expect(doc["@context"]).toContain("https://www.w3.org/ns/did/v1");
      expect(doc["@context"]).toContain(
        "https://w3id.org/security/suites/jws-2020/v1",
      );

      // DID identifier
      expect(doc.id).toBe("did:web:grcorsair.com");

      // Verification method
      expect(doc.verificationMethod).toHaveLength(1);
      const vm = doc.verificationMethod[0];
      expect(vm.id).toBe("did:web:grcorsair.com#key-1");
      expect(vm.type).toBe("JsonWebKey2020");
      expect(vm.controller).toBe("did:web:grcorsair.com");
      expect(vm.publicKeyJwk).toBeDefined();
      expect(vm.publicKeyJwk.kty).toBe("OKP");
      expect(vm.publicKeyJwk.crv).toBe("Ed25519");
      expect(typeof vm.publicKeyJwk.x).toBe("string");
      expect((vm.publicKeyJwk.x as string).length).toBeGreaterThan(0);

      // Authentication and assertion references
      expect(doc.authentication).toContain("did:web:grcorsair.com#key-1");
      expect(doc.assertionMethod).toContain("did:web:grcorsair.com#key-1");
    });

    test("publicKeyJwk contains a real Ed25519 public key (not placeholder)", async () => {
      const keyDir = createTestDir();
      const manager = new MarqueKeyManager(keyDir);
      await manager.generateKeypair();

      const doc = await manager.generateDIDDocument("grcorsair.com");
      const x = doc.verificationMethod[0].publicKeyJwk.x as string;

      // Ed25519 public key is 32 bytes = 43 base64url chars (without padding)
      expect(x.length).toBeGreaterThanOrEqual(42);
      expect(x).not.toBe("PLACEHOLDER_REPLACE_WITH_REAL_KEY");
    });

    test("two different keypairs produce different DID documents", async () => {
      const keyDir1 = createTestDir();
      const manager1 = new MarqueKeyManager(keyDir1);
      await manager1.generateKeypair();
      const doc1 = await manager1.generateDIDDocument("grcorsair.com");

      const keyDir2 = createTestDir();
      const manager2 = new MarqueKeyManager(keyDir2);
      await manager2.generateKeypair();
      const doc2 = await manager2.generateDIDDocument("grcorsair.com");

      // Same structure but different keys
      expect(doc1.id).toBe(doc2.id);
      expect(doc1.verificationMethod[0].publicKeyJwk.x).not.toBe(
        doc2.verificationMethod[0].publicKeyJwk.x,
      );
    });
  });

  describe("generated document can be verified by resolveDIDDocument", () => {
    test("mock fetch returning generated document resolves successfully", async () => {
      const keyDir = createTestDir();
      const manager = new MarqueKeyManager(keyDir);
      await manager.generateKeypair();

      const doc = await manager.generateDIDDocument("grcorsair.com");

      // Mock fetch to return the generated document
      const mockFetch = async (_url: string) =>
        ({
          ok: true,
          json: async () => doc,
        }) as unknown as Response;

      const result = await resolveDIDDocument(
        "did:web:grcorsair.com",
        mockFetch,
      );

      expect(result.didDocument).not.toBeNull();
      expect(result.didDocument!.id).toBe("did:web:grcorsair.com");
      expect(result.didResolutionMetadata.error).toBeUndefined();
      expect(result.didDocument!.verificationMethod[0].publicKeyJwk.kty).toBe(
        "OKP",
      );
    });

    test("resolved document key matches generated document key", async () => {
      const keyDir = createTestDir();
      const manager = new MarqueKeyManager(keyDir);
      await manager.generateKeypair();

      const doc = await manager.generateDIDDocument("grcorsair.com");
      const originalX = doc.verificationMethod[0].publicKeyJwk.x;

      const mockFetch = async (_url: string) =>
        ({
          ok: true,
          json: async () => doc,
        }) as unknown as Response;

      const result = await resolveDIDDocument(
        "did:web:grcorsair.com",
        mockFetch,
      );

      expect(result.didDocument!.verificationMethod[0].publicKeyJwk.x).toBe(
        originalX,
      );
    });
  });

  describe("domain encoding for special characters", () => {
    test("encodes port in localhost:3000", async () => {
      const keyDir = createTestDir();
      const manager = new MarqueKeyManager(keyDir);
      await manager.generateKeypair();

      const doc = await manager.generateDIDDocument("localhost:3000");

      expect(doc.id).toBe("did:web:localhost%3A3000");
      expect(doc.verificationMethod[0].id).toBe(
        "did:web:localhost%3A3000#key-1",
      );
      expect(doc.verificationMethod[0].controller).toBe(
        "did:web:localhost%3A3000",
      );
    });

    test("encodes port in localhost:8080", async () => {
      const keyDir = createTestDir();
      const manager = new MarqueKeyManager(keyDir);
      await manager.generateKeypair();

      const doc = await manager.generateDIDDocument("localhost:8080");

      expect(doc.id).toBe("did:web:localhost%3A8080");
    });

    test("handles subdomain correctly", async () => {
      const keyDir = createTestDir();
      const manager = new MarqueKeyManager(keyDir);
      await manager.generateKeypair();

      const doc = await manager.generateDIDDocument("api.grcorsair.com");

      expect(doc.id).toBe("did:web:api.grcorsair.com");
      expect(doc.verificationMethod[0].id).toBe(
        "did:web:api.grcorsair.com#key-1",
      );
    });
  });

  describe("CLI script", () => {
    test("bin/corsair-did-generate.ts exists and is parseable", async () => {
      const cliPath = path.join(
        __dirname,
        "..",
        "..",
        "bin",
        "corsair-did-generate.ts",
      );
      expect(fs.existsSync(cliPath)).toBe(true);

      // Verify it can be parsed by Bun (imports resolve)
      const content = fs.readFileSync(cliPath, "utf-8");
      expect(content).toContain("MarqueKeyManager");
      expect(content).toContain("--domain");
      expect(content).toContain("--output");
    });

    test("CLI exports main and parseArgs functions", async () => {
      const { main, parseArgs } = await import(
        "../../bin/corsair-did-generate"
      );
      expect(typeof main).toBe("function");
      expect(typeof parseArgs).toBe("function");
    });

    test("parseArgs handles --domain flag", async () => {
      const { parseArgs } = await import("../../bin/corsair-did-generate");
      // Save original argv
      const originalArgv = process.argv;
      try {
        process.argv = ["bun", "corsair-did-generate.ts", "--domain", "test.example.com"];
        const args = parseArgs();
        expect(args.domain).toBe("test.example.com");
      } finally {
        process.argv = originalArgv;
      }
    });

    test("parseArgs defaults domain to grcorsair.com", async () => {
      const { parseArgs } = await import("../../bin/corsair-did-generate");
      const originalArgv = process.argv;
      try {
        process.argv = ["bun", "corsair-did-generate.ts"];
        const args = parseArgs();
        expect(args.domain).toBe("grcorsair.com");
      } finally {
        process.argv = originalArgv;
      }
    });
  });

  describe("placeholder DID document", () => {
    test("apps/web/public/.well-known/did.json exists", () => {
      const didJsonPath = path.join(
        __dirname,
        "..",
        "..",
        "apps",
        "web",
        "public",
        ".well-known",
        "did.json",
      );
      expect(fs.existsSync(didJsonPath)).toBe(true);
    });

    test("placeholder DID document has correct structure", () => {
      const didJsonPath = path.join(
        __dirname,
        "..",
        "..",
        "apps",
        "web",
        "public",
        ".well-known",
        "did.json",
      );
      const content = JSON.parse(fs.readFileSync(didJsonPath, "utf-8"));

      expect(content["@context"]).toContain("https://www.w3.org/ns/did/v1");
      expect(content["@context"]).toContain(
        "https://w3id.org/security/suites/jws-2020/v1",
      );
      expect(content.id).toBe("did:web:grcorsair.com");
      expect(content.verificationMethod).toHaveLength(1);
      expect(content.verificationMethod[0].type).toBe("JsonWebKey2020");
      expect(content.verificationMethod[0].id).toBe(
        "did:web:grcorsair.com#key-1",
      );
      expect(content.verificationMethod[0].controller).toBe(
        "did:web:grcorsair.com",
      );
      expect(content.verificationMethod[0].publicKeyJwk.kty).toBe("OKP");
      expect(content.verificationMethod[0].publicKeyJwk.crv).toBe("Ed25519");
      expect(content.authentication).toContain(
        "did:web:grcorsair.com#key-1",
      );
      expect(content.assertionMethod).toContain(
        "did:web:grcorsair.com#key-1",
      );
    });
  });
});
