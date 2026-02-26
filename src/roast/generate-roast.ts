import type { FetchLike } from "../types/fetch";
import type { RoastCategory, RoastCopyInput, RoastCopyOutput } from "./types";

interface AnthropicMessageResponse {
  content?: Array<{ type?: string; text?: string }>;
}

export interface GenerateRoastDeps {
  apiKey?: string;
  model?: string;
  fetchFn?: FetchLike;
}

const CATEGORIES: RoastCategory[] = [
  "discoverability",
  "verifiability",
  "freshness",
  "machine-readability",
  "transparency",
];

function fallbackCopy(input: RoastCopyInput): RoastCopyOutput {
  const categoryRoasts = {
    discoverability: "",
    verifiability: "",
    freshness: "",
    "machine-readability": "",
    transparency: "",
  } as Record<RoastCategory, string>;

  for (const category of CATEGORIES) {
    const check = input.checks.find((c) => c.category === category);
    if (!check) {
      categoryRoasts[category] = "No data found for this category.";
      continue;
    }

    const anchorFinding = check.findings[0] || "No clear finding captured.";
    categoryRoasts[category] = `${category} scored ${check.score.toFixed(1)}/10. ${anchorFinding}`;
  }

  const scrapedPages = input.pageSignals?.length || 0;

  return {
    categoryRoasts,
    summaryRoast: `${input.domain} landed at ${input.compositeScore.toFixed(1)}/10 (${input.verdict}) after scanning ${scrapedPages} trust-center page(s). Improvements are possible with stronger evidence freshness, cryptographic proofs, and clearer machine-readable artifacts.`,
    fixPreview: `Tighten trust-center evidence on ${input.domain}: publish verifiable artifacts, keep timestamps fresh, and expose machine-readable endpoints buyers can validate automatically.`,
  };
}

function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const directParse = (() => {
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return null;
    }
  })();
  if (directParse) return directParse;

  const fenceMatch = trimmed.match(/```json\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1] || "") as unknown;
    } catch {
      return null;
    }
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as unknown;
    } catch {
      return null;
    }
  }

  return null;
}

function parseProviderPayload(payload: unknown): RoastCopyOutput | null {
  if (!payload || typeof payload !== "object") return null;
  const parsed = payload as {
    categoryRoasts?: Partial<Record<RoastCategory, unknown>>;
    summaryRoast?: unknown;
    fixPreview?: unknown;
  };

  const categoryRoasts = {
    discoverability: String(parsed.categoryRoasts?.discoverability || ""),
    verifiability: String(parsed.categoryRoasts?.verifiability || ""),
    freshness: String(parsed.categoryRoasts?.freshness || ""),
    "machine-readability": String(parsed.categoryRoasts?.["machine-readability"] || ""),
    transparency: String(parsed.categoryRoasts?.transparency || ""),
  } as Record<RoastCategory, string>;

  const summaryRoast = typeof parsed.summaryRoast === "string" ? parsed.summaryRoast.trim() : "";
  const fixPreview = typeof parsed.fixPreview === "string" ? parsed.fixPreview.trim() : "";

  if (!summaryRoast || !fixPreview) return null;
  for (const category of CATEGORIES) {
    if (!categoryRoasts[category] || categoryRoasts[category].trim().length === 0) {
      return null;
    }
  }

  return {
    categoryRoasts,
    summaryRoast,
    fixPreview,
  };
}

function buildPrompt(input: RoastCopyInput): string {
  const findings = input.checks
    .map((check) => `${check.category} (${check.score.toFixed(1)}/10):\n${check.findings.map((f) => `- ${f}`).join("\n")}`)
    .join("\n\n");

  const pageSignals = (input.pageSignals || [])
    .slice(0, 4)
    .map((page) => [
      `URL: ${page.url}`,
      `Title: ${page.title || "n/a"}`,
      `Keywords: ${page.keywordHits.join(", ") || "none"}`,
      `Links: total=${page.linkCount}, pdf=${page.pdfLinkCount}, structured=${page.structuredLinkCount}, status=${page.statusLinkCount}`,
      `Dates: ${page.dateMentions.join(", ") || "none"}`,
      `Excerpt: ${page.excerpt.slice(0, 450)}`,
    ].join("\n"))
    .join("\n\n");

  return [
    `Domain: ${input.domain}`,
    `Composite: ${input.compositeScore.toFixed(1)}/10`,
    `Verdict: ${input.verdict}`,
    "",
    "Use only these findings:",
    findings,
    "",
    "Scraped trust-center page evidence:",
    pageSignals || "(none)",
    "",
    "Return strict JSON with keys: categoryRoasts, summaryRoast, fixPreview.",
    "Do not invent findings.",
  ].join("\n");
}

export async function generateRoastCopy(
  input: RoastCopyInput,
  deps: GenerateRoastDeps = {},
): Promise<RoastCopyOutput> {
  const apiKey = deps.apiKey || Bun.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return fallbackCopy(input);
  }

  const doFetch = deps.fetchFn || globalThis.fetch;
  const model = deps.model || Bun.env.ROAST_ANTHROPIC_MODEL || process.env.ROAST_ANTHROPIC_MODEL || "claude-4-5-haiku-latest";

  try {
    const response = await doFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 900,
        temperature: 0.7,
        system: "You are a compliance roast writer. Roast practices, not people. Never fabricate findings.",
        messages: [
          {
            role: "user",
            content: buildPrompt(input),
          },
        ],
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return fallbackCopy(input);
    }

    const data = await response.json() as AnthropicMessageResponse;
    const text = data.content?.find((entry) => entry.type === "text")?.text || "";
    const payload = extractJsonObject(text);
    const parsed = parseProviderPayload(payload);
    if (!parsed) {
      return fallbackCopy(input);
    }

    return parsed;
  } catch {
    return fallbackCopy(input);
  }
}
