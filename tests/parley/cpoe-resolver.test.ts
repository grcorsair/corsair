import { describe, test, expect } from "bun:test";
import { resolveCpoeList, fetchCpoeJwt } from "../../src/parley/cpoe-resolver";
import type { TrustTxtResolution } from "../../src/parley/trust-txt";
import type { ComplianceCatalogResolution } from "../../src/parley/compliance-catalog";

function trustTxtResolution(data: Partial<TrustTxtResolution>): TrustTxtResolution {
  return {
    trustTxt: data.trustTxt ?? null,
    error: data.error,
    source: data.source,
    url: data.url,
    delegated: data.delegated,
  } as TrustTxtResolution;
}

describe("cpoe-resolver", () => {
  test("prefers catalog entries when available", async () => {
    const resolution = await resolveCpoeList("acme.com", {
      resolveTrustTxt: async () => trustTxtResolution({
        trustTxt: {
          did: "did:web:acme.com",
          cpoes: ["https://acme.com/cpoe-1.jwt"],
          catalog: "https://acme.com/catalog.json",
          frameworks: [],
        },
        url: "https://acme.com/.well-known/trust.txt",
        source: "well-known",
      }),
      resolveComplianceCatalog: async () => ({
        catalog: {
          version: "1",
          generatedAt: "2026-02-01T00:00:00Z",
          cpoes: [
            { url: "https://acme.com/cpoe-2.jwt", issuedAt: "2026-02-10T00:00:00Z" },
            { url: "https://acme.com/cpoe-1.jwt", issuedAt: "2025-12-31T00:00:00Z" },
          ],
        },
      } as ComplianceCatalogResolution),
    });

    expect(resolution.source).toBe("catalog");
    expect(resolution.cpoes[0]?.url).toBe("https://acme.com/cpoe-2.jwt");
    expect(resolution.catalogUrl).toBe("https://acme.com/catalog.json");
  });

  test("falls back to trust.txt when catalog fails", async () => {
    const resolution = await resolveCpoeList("acme.com", {
      resolveTrustTxt: async () => trustTxtResolution({
        trustTxt: {
          did: "did:web:acme.com",
          cpoes: ["https://acme.com/cpoe-1.jwt", "https://acme.com/cpoe-2.jwt"],
          catalog: "https://acme.com/catalog.json",
          frameworks: [],
        },
        url: "https://acme.com/.well-known/trust.txt",
        source: "well-known",
      }),
      resolveComplianceCatalog: async () => ({
        catalog: null,
        error: "HTTP 404",
      }),
    });

    expect(resolution.source).toBe("trust-txt");
    expect(resolution.cpoes).toHaveLength(2);
    expect(resolution.catalogError).toBe("HTTP 404");
  });

  test("fetchCpoeJwt extracts JWT from JSON envelope", async () => {
    const fetchFn = async () => new Response(JSON.stringify({ cpoe: "eyJ.header.payload" }));
    const result = await fetchCpoeJwt("https://acme.com/cpoe.json", fetchFn as any);
    expect(result.jwt).toBe("eyJ.header.payload");
  });

  test("fetchCpoeJwt rejects non-https URLs", async () => {
    const result = await fetchCpoeJwt("http://acme.com/cpoe.jwt");
    expect(result.jwt).toBeNull();
    expect(result.error).toContain("HTTPS");
  });
});
