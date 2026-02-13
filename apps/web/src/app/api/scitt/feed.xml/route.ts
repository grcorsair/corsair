import { NextResponse } from "next/server";

const API_BASE = process.env.CORSAIR_API_URL ?? "https://api.grcorsair.com";

export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/scitt/entries?limit=50`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!res.ok) {
      return new NextResponse("Feed unavailable", { status: 502 });
    }

    const entries = await res.json() as Array<{
      entryId: string;
      registrationTime: string;
      issuer: string;
      scope: string;
      assuranceLevel?: number;
      summary?: { overallScore: number; controlsTested: number };
    }>;

    const items = entries
      .map((entry) => {
        const domain = entry.issuer.replace("did:web:", "").replace(/%3A/g, ":");
        const level = entry.assuranceLevel != null ? `L${entry.assuranceLevel}` : "L0";
        const score = entry.summary?.overallScore ?? 0;

        return `    <item>
      <title>${escapeXml(domain)} — ${escapeXml(entry.scope)} (${level}, Score: ${score})</title>
      <link>https://grcorsair.com/marque?entryId=${escapeXml(entry.entryId)}</link>
      <guid isPermaLink="false">${escapeXml(entry.entryId)}</guid>
      <pubDate>${new Date(entry.registrationTime).toUTCString()}</pubDate>
      <description>CPOE registered by ${escapeXml(domain)}. Scope: ${escapeXml(entry.scope)}. Assurance: ${level}. Score: ${score}/100.</description>
    </item>`;
      })
      .join("\n");

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
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

    return new NextResponse(rss, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch {
    return new NextResponse("Feed unavailable", { status: 502 });
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
