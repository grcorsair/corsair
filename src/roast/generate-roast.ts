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

const CATEGORY_STYLE: Record<RoastCategory, { low: string[]; mid: string[]; high: string[] }> = {
  discoverability: {
    low: [
      "This trust center is playing hide-and-seek and winning.",
      "Discoverability is currently set to stealth mode.",
    ],
    mid: [
      "People can find this trust center, but with side-quest energy.",
      "The map exists, but the legend is missing.",
    ],
    high: [
      "Discoverability is solid. People can find the receipts fast.",
      "This trust center is easy to locate and hard to ignore.",
    ],
  },
  verifiability: {
    low: [
      "Trust claims are loud, cryptographic proof is whispering.",
      "Right now it is vibes first, verification second.",
    ],
    mid: [
      "Some proof exists, but the chain still has weak links.",
      "You started the verification journey; finish the route.",
    ],
    high: [
      "Verification posture is strong and mostly evidence-backed.",
      "Proof beats promises here, and it shows.",
    ],
  },
  freshness: {
    low: [
      "This page feels like it was last updated in another era.",
      "Freshness is giving museum exhibit right now.",
    ],
    mid: [
      "Some updates are recent, but cadence is uneven.",
      "Freshness is decent, but still not real-time ready.",
    ],
    high: [
      "Freshness is sharp and buyer-friendly.",
      "Update cadence looks alive, not archived.",
    ],
  },
  "machine-readability": {
    low: [
      "Machines asked for JSON and got a PDF scavenger hunt.",
      "Automation is trying, but the artifact format is fighting back.",
    ],
    mid: [
      "There are machine-readable hints, but not enough structure yet.",
      "Readable by bots in parts, manual in too many places.",
    ],
    high: [
      "Machine-readability is strong and integration-ready.",
      "Artifacts look built for APIs, not screenshots.",
    ],
  },
  transparency: {
    low: [
      "Transparency is currently more teaser trailer than full release.",
      "Status visibility is thin when buyers need detail.",
    ],
    mid: [
      "Transparency signals exist, but depth is inconsistent.",
      "Some visibility is there, but confidence still needs more context.",
    ],
    high: [
      "Transparency posture is clear and confidence-building.",
      "Status and disclosure signals are doing real work.",
    ],
  },
};

function hashSeed(input: string): number {
  let hash = 0;
  for (let idx = 0; idx < input.length; idx += 1) {
    hash = (hash * 31 + input.charCodeAt(idx)) >>> 0;
  }
  return hash;
}

function pickBySeed(options: string[], seed: string): string {
  if (options.length === 0) return "";
  const idx = hashSeed(seed) % options.length;
  return options[idx] || options[0] || "";
}

function styleBucket(score: number): "low" | "mid" | "high" {
  if (score < 4.5) return "low";
  if (score < 7.5) return "mid";
  return "high";
}

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
    const style = CATEGORY_STYLE[category];
    const bucket = styleBucket(check.score);
    const opener = pickBySeed(style[bucket], `${input.domain}:${category}:${anchorFinding}`);
    categoryRoasts[category] = `${opener} ${anchorFinding}`;
  }

  const scrapedPages = input.pageSignals?.length || 0;
  const scorePhrase = input.compositeScore < 4.5
    ? "a compliance jump-scare"
    : input.compositeScore < 7.5
      ? "a work-in-progress trust posture"
      : "a genuinely credible trust posture";

  return {
    categoryRoasts,
    summaryRoast: `${input.domain} scored ${input.compositeScore.toFixed(1)}/10 (${input.verdict}) after scanning ${scrapedPages} trust-center page(s). Right now this reads as ${scorePhrase}. The good news: every weak spot has a fixable evidence path.`,
    fixPreview: `Next move for ${input.domain}: publish trust.txt + verifiable artifacts, keep dated evidence fresh, and add machine-readable endpoints so buyers can verify without opening ten PDFs.`,
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
    "Writing style requirements:",
    "- Tone: witty, punchy, and playful (party-game energy).",
    "- Roast practices, not people. No insults about protected traits.",
    "- Keep each category roast to 1-2 short sentences and <= 35 words.",
    "- Make jokes specific to the actual findings; do not use generic filler.",
    "- Keep fixPreview concrete and actionable, with trust.txt/CPOE direction when relevant.",
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
        system: "You are a compliance roast writer with sharp one-liner timing. Roast practices, not people. Never fabricate findings. Keep output high-signal and funny.",
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
