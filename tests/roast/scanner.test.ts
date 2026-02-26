import { describe, test, expect } from "bun:test";

import { scanDomain } from "../../src/roast/scanner";

describe("roast scanner", () => {
  test("returns deterministic checks and verdict for healthy domain", async () => {
    const deps = {
      resolveTrustTxt: async () => ({
        trustTxt: {
          did: "did:web:acme.com",
          cpoes: ["https://acme.com/cpoe/latest.jwt", "https://acme.com/cpoe/prev.jwt"],
          scitt: "https://acme.com/scitt/entries",
          flagship: "https://acme.com/ssf/streams",
          frameworks: ["SOC2", "ISO27001"],
          contact: "security@acme.com",
          expires: "2027-01-01T00:00:00Z",
        },
        source: "well-known" as const,
        url: "https://acme.com/.well-known/trust.txt",
      }),
      resolveCpoeList: async () => ({
        cpoes: [
          {
            url: "https://acme.com/cpoe/latest.jwt",
            issuedAt: "2026-02-20T00:00:00Z",
          },
          {
            url: "https://acme.com/cpoe/prev.jwt",
            issuedAt: "2026-02-10T00:00:00Z",
          },
        ],
        source: "trust-txt" as const,
      }),
      fetchCpoeJwt: async () => ({
        jwt: "eyJhbGciOiJFZERTQSJ9.eyJpc3MiOiJkaWQ6d2ViOmFjbWUuY29tIiwiaWF0IjoxNzA4Mzg3MjAwLCJleHAiOjE3MTEwNTkyMDB9.signature",
      }),
      verifyVCJWTViaDID: async () => ({
        valid: true,
        issuerTier: "self-signed" as const,
        signedBy: "did:web:acme.com",
      }),
      resolveDIDDocument: async () => ({
        didDocument: {
          "@context": ["https://www.w3.org/ns/did/v1"],
          id: "did:web:acme.com",
          verificationMethod: [],
          authentication: [],
          assertionMethod: [],
        },
        didDocumentMetadata: {},
        didResolutionMetadata: {},
      }),
      resolveScittEntries: async () => ({
        entries: [{ entryId: "entry-1" }, { entryId: "entry-2" }, { entryId: "entry-3" }],
      }),
      fetchFn: async () => new Response("Contact: security@acme.com", { status: 200 }),
      now: () => new Date("2026-02-26T00:00:00Z"),
      maxCpoes: 2,
    };

    const first = await scanDomain("acme.com", deps as never);
    const second = await scanDomain("acme.com", deps as never);

    expect(first.checks).toHaveLength(5);
    expect(first.verdict).toBe(second.verdict);
    expect(first.compositeScore).toBe(second.compositeScore);
    expect(first.verdict).toBe("CORSAIR READY");
  });

  test("returns low discoverability when trust.txt is missing", async () => {
    const result = await scanDomain("ghost.example", {
      resolveTrustTxt: async () => ({
        trustTxt: null,
        error: "Resolution failed",
      }),
      resolveCpoeList: async () => ({ cpoes: [], source: "trust-txt" as const }),
      fetchFn: async () => new Response("not found", { status: 404 }),
      now: () => new Date("2026-02-26T00:00:00Z"),
    } as never);

    const discoverability = result.checks.find((c) => c.category === "discoverability");
    expect(discoverability).toBeTruthy();
    expect(discoverability!.score).toBeLessThan(2);
    expect(discoverability!.findings.join(" ")).toContain("No trust.txt");
  });
});
