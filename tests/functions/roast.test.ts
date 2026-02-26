import { describe, test, expect } from "bun:test";

import { createRoastRouter } from "../../functions/roast";
import { createMemoryRoastStore } from "../../src/roast/storage";

function jsonRequest(path: string, method: "GET" | "POST", body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("roast router", () => {
  test("rejects invalid domain", async () => {
    const router = createRoastRouter({
      store: createMemoryRoastStore(),
      scanDomain: async () => {
        throw new Error("should not run");
      },
      generateRoastCopy: async () => {
        throw new Error("should not run");
      },
      generateTrustTxtExample: () => "",
      now: () => new Date("2026-02-26T00:00:00Z"),
    });

    const res = await router(jsonRequest("/roast", "POST", { domain: "bad domain" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("INVALID_DOMAIN");
  });

  test("creates and retrieves roast result", async () => {
    const store = createMemoryRoastStore();
    const router = createRoastRouter({
      store,
      scanDomain: async (domain) => ({
        domain,
        compositeScore: 6.2,
        verdict: "GETTING THERE",
        checks: [
          { category: "discoverability", score: 6, findings: ["trust.txt found"] },
          { category: "verifiability", score: 6, findings: ["valid cpoe"] },
          { category: "freshness", score: 6, findings: ["recent evidence"] },
          { category: "machine-readability", score: 6, findings: ["catalog present"] },
          { category: "transparency", score: 7, findings: ["scitt entries present"] },
        ],
        pageSignals: [
          {
            url: "https://acme.com/trust",
            title: "Acme Trust Center",
            excerpt: "SOC 2 and ISO 27001 overview page",
            linkCount: 5,
            pdfLinkCount: 1,
            structuredLinkCount: 1,
            statusLinkCount: 1,
            keywordHits: ["trust", "soc 2"],
            dateMentions: ["2026-02-20"],
          },
        ],
      }),
      generateRoastCopy: async () => ({
        categoryRoasts: {
          discoverability: "discoverability roast",
          verifiability: "verifiability roast",
          freshness: "freshness roast",
          "machine-readability": "machine-readability roast",
          transparency: "transparency roast",
        },
        summaryRoast: "summary",
        fixPreview: "fix",
      }),
      generateTrustTxtExample: (domain) => `DID: did:web:${domain}`,
      now: () => new Date("2026-02-26T00:00:00Z"),
    });

    const createRes = await router(jsonRequest("/roast", "POST", { domain: "acme.com" }));
    expect(createRes.status).toBe(200);
    const created = await createRes.json();
    expect(created.result.id).toBeTruthy();
    expect(created.result.checks[0].roast).toBe("discoverability roast");

    const getRes = await router(jsonRequest(`/roast/${created.result.id}`, "GET"));
    expect(getRes.status).toBe(200);
    const fetched = await getRes.json();
    expect(fetched.result.id).toBe(created.result.id);
    expect(fetched.result.pageSignals?.[0]?.url).toBe("https://acme.com/trust");
  });

  test("accepts trust-center URL input and normalizes to domain", async () => {
    const store = createMemoryRoastStore();
    const seen: string[] = [];
    const router = createRoastRouter({
      store,
      scanDomain: async (domain) => {
        seen.push(domain);
        return {
          domain,
          compositeScore: 6.2,
          verdict: "GETTING THERE",
          checks: [
            { category: "discoverability", score: 6, findings: ["trust page found"] },
            { category: "verifiability", score: 6, findings: ["claims listed"] },
            { category: "freshness", score: 6, findings: ["recent updates"] },
            { category: "machine-readability", score: 6, findings: ["json endpoint"] },
            { category: "transparency", score: 6, findings: ["status page present"] },
          ],
          pageSignals: [],
        };
      },
      generateRoastCopy: async () => ({
        categoryRoasts: {
          discoverability: "discoverability roast",
          verifiability: "verifiability roast",
          freshness: "freshness roast",
          "machine-readability": "machine-readability roast",
          transparency: "transparency roast",
        },
        summaryRoast: "summary",
        fixPreview: "fix",
      }),
      generateTrustTxtExample: () => "DID: did:web:trust.acme.com",
      now: () => new Date("2026-02-26T00:00:00Z"),
    });

    const res = await router(jsonRequest("/roast", "POST", { domain: "https://trust.acme.com/" }));
    expect(res.status).toBe(200);
    expect(seen[0]).toBe("trust.acme.com");
  });
});
