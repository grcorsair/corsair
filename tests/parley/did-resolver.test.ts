/**
 * DID Resolver Test Contract
 *
 * Tests DID:web parsing, formatting, and resolution for Parley protocol.
 * Covers parse/format utilities, mock resolution, and error cases.
 */

import { describe, test, expect } from "bun:test";
import {
  parseDIDWeb,
  formatDIDWeb,
  resolveDIDDocument,
} from "../../src/parley/did-resolver";
import type {
  DIDDocument,
  VerificationMethod,
  DIDResolutionResult,
} from "../../src/parley/did-resolver";

describe("DID Resolver - did:web Resolution", () => {
  describe("parseDIDWeb", () => {
    test("parses simple domain DID", () => {
      const result = parseDIDWeb("did:web:grcorsair.com");
      expect(result.domain).toBe("grcorsair.com");
      expect(result.path).toBeUndefined();
    });

    test("parses DID with path segments", () => {
      const result = parseDIDWeb("did:web:grcorsair.com:users:alice");
      expect(result.domain).toBe("grcorsair.com");
      expect(result.path).toBe("users/alice");
    });

    test("decodes percent-encoded port in domain", () => {
      const result = parseDIDWeb("did:web:localhost%3A3000");
      expect(result.domain).toBe("localhost:3000");
      expect(result.path).toBeUndefined();
    });

    test("decodes percent-encoded port with path", () => {
      const result = parseDIDWeb("did:web:localhost%3A8080:api:v1");
      expect(result.domain).toBe("localhost:8080");
      expect(result.path).toBe("api/v1");
    });

    test("throws on non-did:web method", () => {
      expect(() => parseDIDWeb("did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK")).toThrow();
    });

    test("throws on invalid DID format (missing prefix)", () => {
      expect(() => parseDIDWeb("web:grcorsair.com")).toThrow();
    });

    test("throws on empty domain", () => {
      expect(() => parseDIDWeb("did:web:")).toThrow();
    });
  });

  describe("formatDIDWeb", () => {
    test("formats simple domain to did:web", () => {
      const did = formatDIDWeb("grcorsair.com");
      expect(did).toBe("did:web:grcorsair.com");
    });

    test("formats domain with path", () => {
      const did = formatDIDWeb("grcorsair.com", "users/alice");
      expect(did).toBe("did:web:grcorsair.com:users:alice");
    });

    test("encodes port in domain", () => {
      const did = formatDIDWeb("localhost:3000");
      expect(did).toBe("did:web:localhost%3A3000");
    });

    test("encodes port with path", () => {
      const did = formatDIDWeb("localhost:8080", "api/v1");
      expect(did).toBe("did:web:localhost%3A8080:api:v1");
    });

    test("roundtrips with parseDIDWeb", () => {
      const original = "did:web:grcorsair.com:orgs:corsair";
      const parsed = parseDIDWeb(original);
      const formatted = formatDIDWeb(parsed.domain, parsed.path);
      expect(formatted).toBe(original);
    });

    test("roundtrips with port", () => {
      const original = "did:web:localhost%3A3000:api:v2";
      const parsed = parseDIDWeb(original);
      const formatted = formatDIDWeb(parsed.domain, parsed.path);
      expect(formatted).toBe(original);
    });
  });

  describe("DIDDocument type", () => {
    test("DIDDocument has all required fields", () => {
      const doc: DIDDocument = {
        "@context": [
          "https://www.w3.org/ns/did/v1",
          "https://w3id.org/security/suites/jws-2020/v1",
        ],
        id: "did:web:grcorsair.com",
        verificationMethod: [
          {
            id: "did:web:grcorsair.com#key-1",
            type: "JsonWebKey2020",
            controller: "did:web:grcorsair.com",
            publicKeyJwk: {
              kty: "OKP",
              crv: "Ed25519",
              x: "base64url-encoded-public-key",
            },
          },
        ],
        authentication: ["did:web:grcorsair.com#key-1"],
        assertionMethod: ["did:web:grcorsair.com#key-1"],
      };

      expect(doc.id).toBe("did:web:grcorsair.com");
      expect(doc["@context"]).toContain("https://www.w3.org/ns/did/v1");
      expect(doc.verificationMethod).toHaveLength(1);
      expect(doc.verificationMethod[0].type).toBe("JsonWebKey2020");
      expect(doc.verificationMethod[0].publicKeyJwk.kty).toBe("OKP");
      expect(doc.authentication).toContain("did:web:grcorsair.com#key-1");
      expect(doc.assertionMethod).toContain("did:web:grcorsair.com#key-1");
    });
  });

  describe("resolveDIDDocument", () => {
    test("resolves a valid DID document via mock fetch", async () => {
      const mockDIDDocument: DIDDocument = {
        "@context": ["https://www.w3.org/ns/did/v1"],
        id: "did:web:grcorsair.com",
        verificationMethod: [
          {
            id: "did:web:grcorsair.com#key-1",
            type: "JsonWebKey2020",
            controller: "did:web:grcorsair.com",
            publicKeyJwk: { kty: "OKP", crv: "Ed25519", x: "test-key" },
          },
        ],
        authentication: ["did:web:grcorsair.com#key-1"],
        assertionMethod: ["did:web:grcorsair.com#key-1"],
      };

      const mockFetch = async (_url: string) => ({
        ok: true,
        json: async () => mockDIDDocument,
      }) as unknown as Response;

      const result = await resolveDIDDocument("did:web:grcorsair.com", mockFetch);

      expect(result.didDocument).not.toBeNull();
      expect(result.didDocument!.id).toBe("did:web:grcorsair.com");
      expect(result.didResolutionMetadata.error).toBeUndefined();
    });

    test("constructs correct URL for simple domain (.well-known/did.json)", async () => {
      let capturedUrl = "";
      const mockFetch = async (url: string) => {
        capturedUrl = url;
        return {
          ok: true,
          json: async () => ({
            "@context": ["https://www.w3.org/ns/did/v1"],
            id: "did:web:grcorsair.com",
            verificationMethod: [],
            authentication: [],
            assertionMethod: [],
          }),
        } as unknown as Response;
      };

      await resolveDIDDocument("did:web:grcorsair.com", mockFetch);
      expect(capturedUrl).toBe("https://grcorsair.com/.well-known/did.json");
    });

    test("constructs correct URL for DID with path", async () => {
      let capturedUrl = "";
      const mockFetch = async (url: string) => {
        capturedUrl = url;
        return {
          ok: true,
          json: async () => ({
            "@context": ["https://www.w3.org/ns/did/v1"],
            id: "did:web:grcorsair.com:users:alice",
            verificationMethod: [],
            authentication: [],
            assertionMethod: [],
          }),
        } as unknown as Response;
      };

      await resolveDIDDocument("did:web:grcorsair.com:users:alice", mockFetch);
      expect(capturedUrl).toBe("https://grcorsair.com/users/alice/did.json");
    });

    test("returns error result on HTTP failure", async () => {
      const mockFetch = async (_url: string) => ({
        ok: false,
        status: 404,
        statusText: "Not Found",
      }) as unknown as Response;

      const result = await resolveDIDDocument("did:web:unknown.example.com", mockFetch);

      expect(result.didDocument).toBeNull();
      expect(result.didResolutionMetadata.error).toBeDefined();
    });

    test("returns error result on network failure", async () => {
      const mockFetch = async (_url: string): Promise<Response> => {
        throw new Error("Network error");
      };

      const result = await resolveDIDDocument("did:web:unreachable.example.com", mockFetch);

      expect(result.didDocument).toBeNull();
      expect(result.didResolutionMetadata.error).toBeDefined();
    });

    test("returns error for non-did:web method", async () => {
      const result = await resolveDIDDocument("did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK");

      expect(result.didDocument).toBeNull();
      expect(result.didResolutionMetadata.error).toBeDefined();
    });
  });
});
