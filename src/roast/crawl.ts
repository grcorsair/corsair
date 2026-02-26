import { validatePublicUrl } from "../security/url-validation";
import type { FetchLike } from "../types/fetch";
import type { RoastPageSignal } from "./types";

const TRUST_KEYWORDS = [
  "trust",
  "security",
  "compliance",
  "soc 2",
  "iso 27001",
  "certification",
  "audit",
  "privacy",
  "risk",
  "subprocessor",
  "penetration test",
  "bug bounty",
  "status",
  "incident",
] as const;

const CANDIDATE_PATHS = [
  "/",
  "/trust",
  "/trust-center",
  "/security",
  "/compliance",
  "/security/compliance",
  "/legal/trust-center",
  "/security-and-compliance",
];

function domainRoot(domain: string): string {
  const parts = domain.split(".").filter(Boolean);
  if (parts.length <= 2) return domain;
  return parts.slice(-2).join(".");
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)));
}

function normalizeText(input: string): string {
  return decodeHtmlEntities(input)
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return undefined;
  const title = normalizeText(match[1] || "");
  return title.length > 0 ? title : undefined;
}

function extractVisibleText(html: string): string {
  const withoutNoise = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<[^>]+>/g, " ");

  return normalizeText(withoutNoise);
}

function extractHrefValues(html: string): string[] {
  const links: string[] = [];
  const regex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;

  let match = regex.exec(html);
  while (match) {
    const href = (match[1] || "").trim();
    if (href) links.push(href);
    match = regex.exec(html);
  }

  return links;
}

function normalizeCandidateUrl(base: string, href: string): string | null {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("javascript:")) {
    return null;
  }

  try {
    const url = new URL(href, base);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function isLikelyTrustPath(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  return [
    "trust",
    "security",
    "compliance",
    "soc",
    "iso",
    "audit",
    "privacy",
    "risk",
    "status",
    "incident",
    "subprocessor",
  ].some((term) => lower.includes(term));
}

function extractDateMentions(text: string): string[] {
  const hits = new Set<string>();

  const isoRegex = /\b\d{4}-\d{2}-\d{2}\b/g;
  let isoMatch = isoRegex.exec(text);
  while (isoMatch) {
    hits.add(isoMatch[0]);
    isoMatch = isoRegex.exec(text);
  }

  const namedRegex = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},\s+20\d{2}\b/gi;
  let namedMatch = namedRegex.exec(text);
  while (namedMatch) {
    hits.add(namedMatch[0]);
    namedMatch = namedRegex.exec(text);
  }

  return [...hits].slice(0, 12);
}

function buildPageSignal(url: string, body: string, isHtml: boolean): RoastPageSignal {
  const html = body.slice(0, 250_000);
  const text = isHtml ? extractVisibleText(html) : normalizeText(body);
  const excerpt = text.slice(0, 1400);

  const keywordHits: string[] = [];
  const lowerText = text.toLowerCase();
  for (const keyword of TRUST_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      keywordHits.push(keyword);
    }
  }

  const hrefValues = isHtml ? extractHrefValues(html) : [];
  let pdfLinkCount = 0;
  let structuredLinkCount = 0;
  let statusLinkCount = 0;

  for (const href of hrefValues) {
    const lower = href.toLowerCase();
    if (lower.includes(".pdf")) pdfLinkCount += 1;
    if (lower.includes(".json") || lower.includes(".xml") || lower.includes("/api/")) {
      structuredLinkCount += 1;
    }
    if (lower.includes("status") || lower.includes("incident")) {
      statusLinkCount += 1;
    }
  }

  return {
    url,
    title: isHtml ? extractTitle(html) : undefined,
    excerpt,
    linkCount: hrefValues.length,
    pdfLinkCount,
    structuredLinkCount,
    statusLinkCount,
    keywordHits,
    dateMentions: extractDateMentions(text),
  };
}

export interface CrawlTrustCenterDeps {
  fetchFn?: FetchLike;
  maxPages?: number;
  timeoutMs?: number;
}

export async function crawlTrustCenter(
  domain: string,
  deps: CrawlTrustCenterDeps = {},
): Promise<RoastPageSignal[]> {
  const fetchFn = deps.fetchFn || globalThis.fetch;
  const maxPages = Math.max(1, Math.min(deps.maxPages ?? 5, 10));
  const timeoutMs = Math.max(2000, Math.min(deps.timeoutMs ?? 7000, 20000));

  const base = `https://${domain}`;
  const root = domainRoot(domain);
  const queue = CANDIDATE_PATHS.map((path) => new URL(path, base).toString());
  const visited = new Set<string>();
  const signals: RoastPageSignal[] = [];

  while (queue.length > 0 && signals.length < maxPages) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    const valid = validatePublicUrl(current);
    if (!valid.valid) continue;

    let res: Response;
    try {
      res = await fetchFn(current, {
        method: "GET",
        headers: { "user-agent": "CorsairRoastBot/1.0 (+https://grcorsair.com)" },
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      continue;
    }

    if (!res.ok) continue;

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    const isHtml = contentType.includes("text/html") || contentType.includes("application/xhtml+xml");
    const isText = isHtml || contentType.includes("text/plain") || contentType === "";
    if (!isText) continue;

    const body = await res.text().catch(() => "");
    if (!body.trim()) continue;

    const signal = buildPageSignal(current, body, isHtml);
    signals.push(signal);

    if (!isHtml) continue;

    const hrefValues = extractHrefValues(body.slice(0, 250_000));
    for (const href of hrefValues) {
      const normalized = normalizeCandidateUrl(current, href);
      if (!normalized || visited.has(normalized)) continue;

      try {
        const parsed = new URL(normalized);
        const host = parsed.hostname.toLowerCase();
        const hostAllowed = host === domain || host.endsWith(`.${root}`);
        if (!hostAllowed) continue;
        if (!isLikelyTrustPath(parsed.pathname)) continue;

        if (!queue.includes(normalized)) {
          queue.push(normalized);
        }
      } catch {
        // Ignore malformed URL candidates
      }
    }
  }

  return signals;
}
