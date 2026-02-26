import { describe, test, expect } from "bun:test";

import { generateRoastCopy } from "../../src/roast/generate-roast";

describe("generateRoastCopy", () => {
  test("uses deterministic fallback when API key is missing", async () => {
    const result = await generateRoastCopy({
      domain: "acme.com",
      compositeScore: 2.4,
      verdict: "PDF HOARDER",
      checks: [
        {
          category: "discoverability",
          score: 1.0,
          findings: ["No trust.txt found"],
        },
        {
          category: "verifiability",
          score: 2.0,
          findings: ["No valid signatures found"],
        },
        {
          category: "freshness",
          score: 3.0,
          findings: ["Evidence appears stale"],
        },
        {
          category: "machine-readability",
          score: 2.0,
          findings: ["Only PDFs found"],
        },
        {
          category: "transparency",
          score: 1.0,
          findings: ["No SCITT endpoint available"],
        },
      ],
    });

    expect(result.summaryRoast.length).toBeGreaterThan(0);
    expect(result.fixPreview).toContain("acme.com");
    expect(result.categoryRoasts.discoverability).toContain("No trust.txt");
  });

  test("falls back when provider returns malformed JSON", async () => {
    const result = await generateRoastCopy(
      {
        domain: "example.com",
        compositeScore: 5.5,
        verdict: "TRUST ME BRO",
        checks: [
          { category: "discoverability", score: 5, findings: ["trust.txt exists"] },
          { category: "verifiability", score: 5, findings: ["1 valid CPOE"] },
          { category: "freshness", score: 6, findings: ["issued 20 days ago"] },
          { category: "machine-readability", score: 5, findings: ["catalog present"] },
          { category: "transparency", score: 6, findings: ["SCITT entries found"] },
        ],
      },
      {
        apiKey: "test-key",
        fetchFn: async () =>
          new Response(
            JSON.stringify({
              content: [{ type: "text", text: "not valid json" }],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      },
    );

    expect(result.summaryRoast.length).toBeGreaterThan(0);
    expect(result.categoryRoasts.verifiability.length).toBeGreaterThan(0);
  });
});
