import { NextResponse } from "next/server";
import demoEntries from "../../../../../public/demo-scitt-entries.json";

const API_BASE = process.env.CORSAIR_API_URL ?? "https://api.grcorsair.com";

interface FeedEntry {
  entryId: string;
  registrationTime: string;
  issuer: string;
  scope: string;
  provenance?: { source: string; sourceIdentity?: string };
  assuranceLevel?: number;
  summary?: { overallScore: number; controlsTested: number };
}

const PROVENANCE_DISPLAY: Record<string, string> = {
  tool: "Tool-Signed",
  auditor: "Auditor-Attested",
  self: "Self-Reported",
};

function buildRss(entries: FeedEntry[]): string {
  const items = entries
    .map((entry) => {
      const domain = entry.issuer.replace("did:web:", "").replace(/%3A/g, ":");
      const source = entry.provenance?.source ?? "unknown";
      const sourceLabel = PROVENANCE_DISPLAY[source] ?? "Unknown";
      const score = entry.summary?.overallScore ?? 0;

      return `    <item>
      <title>${escapeXml(domain)} — ${escapeXml(entry.scope)} (${sourceLabel}, Score: ${score})</title>
      <link>https://grcorsair.com/marque?entryId=${escapeXml(entry.entryId)}</link>
      <guid isPermaLink="false">${escapeXml(entry.entryId)}</guid>
      <pubDate>${new Date(entry.registrationTime).toUTCString()}</pubDate>
      <description>CPOE registered by ${escapeXml(domain)} via ${sourceLabel.toLowerCase()}. Scope: ${escapeXml(entry.scope)}. Score: ${score}/100.</description>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Corsair SCITT Transparency Log</title>
    <link>https://grcorsair.com/log</link>
    <description>Public feed of CPOEs registered in the SCITT transparency log. Append-only, tamper-evident, publicly auditable.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="https://grcorsair.com/api/scitt/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;
}

const RSS_HEADERS = {
  "Content-Type": "application/rss+xml; charset=utf-8",
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
};

export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/scitt/entries?limit=50`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });

    if (res.ok) {
      const data = await res.json();
      // Backend may return { entries: [...] } or a flat array
      const entries = (Array.isArray(data) ? data : (data.entries ?? [])) as FeedEntry[];
      if (entries.length > 0) {
        return new NextResponse(buildRss(entries), { headers: RSS_HEADERS });
      }
    }
  } catch {
    // Backend unavailable — fall through to demo data
  }

  // Fallback: serve demo data RSS feed
  return new NextResponse(buildRss(demoEntries as FeedEntry[]), {
    headers: RSS_HEADERS,
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
