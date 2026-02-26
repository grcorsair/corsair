import { describe, expect, test } from "bun:test";

import { crawlTrustCenter } from "../../src/roast/crawl";

function makeFetch(pages: Record<string, { status?: number; type?: string; body: string }>): typeof fetch {
  return (async (input: Request | URL | string) => {
    const url = String(input);
    const page = pages[url];
    if (!page) {
      return new Response("not found", { status: 404, headers: { "content-type": "text/plain" } });
    }
    return new Response(page.body, {
      status: page.status ?? 200,
      headers: { "content-type": page.type ?? "text/html" },
    });
  }) as typeof fetch;
}

describe("crawlTrustCenter", () => {
  test("crawls trust-center pages and extracts signals", async () => {
    const fetchFn = makeFetch({
      "https://trust.example/": {
        body: `
          <html>
            <head><title>Trust Center</title></head>
            <body>
              <h1>Security and Compliance</h1>
              <p>Updated February 20, 2026</p>
              <a href="/compliance/soc2">SOC 2</a>
              <a href="/reports/soc2.pdf">SOC 2 report</a>
              <a href="/api/trust.json">JSON feed</a>
              <a href="https://status.example.com">Status</a>
            </body>
          </html>
        `,
      },
      "https://trust.example/compliance/soc2": {
        body: `
          <html>
            <head><title>SOC 2</title></head>
            <body>
              <p>ISO 27001 and SOC 2 attestation details.</p>
            </body>
          </html>
        `,
      },
      "https://trust.example/reports/soc2.pdf": {
        type: "application/pdf",
        body: "pdf",
      },
      "https://trust.example/api/trust.json": {
        type: "application/json",
        body: "{}",
      },
    });

    const pages = await crawlTrustCenter("trust.example", {
      fetchFn,
      maxPages: 3,
      timeoutMs: 3000,
    });

    expect(pages.length).toBeGreaterThan(0);
    expect(pages[0]?.url).toBe("https://trust.example/");
    expect((pages[0]?.keywordHits || []).includes("security")).toBeTrue();
    expect((pages[0]?.keywordHits || []).includes("compliance")).toBeTrue();
    expect(pages[0]?.pdfLinkCount).toBeGreaterThan(0);
    expect(pages[0]?.structuredLinkCount).toBeGreaterThan(0);
    expect(pages[0]?.dateMentions.length).toBeGreaterThan(0);
  });

  test("does not crawl blocked hosts and invalid urls", async () => {
    const fetchFn = makeFetch({
      "https://local.example/": {
        body: `
          <html>
            <body>
              <a href="http://127.0.0.1/admin">blocked</a>
              <a href="javascript:void(0)">ignore</a>
              <a href="mailto:security@example.com">mail</a>
              <a href="/trust">trust</a>
            </body>
          </html>
        `,
      },
      "https://local.example/trust": {
        body: "<html><body><p>Trust docs</p></body></html>",
      },
    });

    const pages = await crawlTrustCenter("local.example", {
      fetchFn,
      maxPages: 5,
    });

    expect(pages.some((page) => page.url.includes("127.0.0.1"))).toBeFalse();
    expect(pages.some((page) => page.url === "https://local.example/trust")).toBeTrue();
  });
});
