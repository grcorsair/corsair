import { NextRequest, NextResponse } from "next/server";
import demoEntries from "../../../../../public/demo-scitt-entries.json";

const API_BASE = process.env.CORSAIR_API_URL ?? "https://api.grcorsair.com";

interface DemoEntry {
  entryId: string;
  registrationTime: string;
  issuer: string;
  scope: string;
  provenance: { source: string; sourceIdentity?: string };
  assuranceLevel?: number;
  summary?: {
    controlsTested: number;
    controlsPassed: number;
    controlsFailed: number;
    overallScore: number;
  };
}

/** Build a demo profile from SCITT entries for a given domain */
function buildDemoProfile(domain: string) {
  const did = `did:web:${domain}`;
  const entries = (demoEntries as DemoEntry[]).filter((e) => e.issuer === did);

  if (entries.length === 0) return null;

  const provenanceSummary = { self: 0, tool: 0, auditor: 0 };
  const frameworks: string[] = [];

  for (const entry of entries) {
    const src = entry.provenance.source;
    if (src === "self" || src === "tool" || src === "auditor") {
      provenanceSummary[src]++;
    }
    // Extract framework hints from scope
    if (entry.scope.includes("SOC 2")) frameworks.push("SOC2");
    if (entry.scope.includes("ISO 27001")) frameworks.push("ISO 27001");
    if (entry.scope.includes("PCI DSS")) frameworks.push("PCI DSS");
    if (entry.scope.includes("HIPAA")) frameworks.push("HIPAA");
    if (entry.scope.includes("NIST")) frameworks.push("NIST 800-53");
  }

  const sorted = entries.sort(
    (a, b) => new Date(b.registrationTime).getTime() - new Date(a.registrationTime).getTime(),
  );
  const latest = sorted[0];

  return {
    did,
    domain,
    displayName: domain.split(".")[0].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    cpoeCount: entries.length,
    provenanceSummary,
    latestCPOE: {
      marqueId: latest.entryId.replace("scitt-", ""),
      scope: latest.scope,
      provenance: latest.provenance,
      assuranceLevel: latest.assuranceLevel,
      overallScore: latest.summary?.overallScore ?? 0,
      issuedAt: latest.registrationTime,
      expiresAt: new Date(
        new Date(latest.registrationTime).getTime() + 180 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    },
    frameworks: [...new Set(frameworks)],
    firstSeen: sorted[sorted.length - 1].registrationTime,
    lastSeen: sorted[0].registrationTime,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ domain: string }> },
) {
  const { domain } = await params;

  try {
    const res = await fetch(`${API_BASE}/profile/${encodeURIComponent(domain)}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });

    if (res.ok) {
      const data = await res.json();
      // Only use backend if it has real data (not empty/error)
      if (data && data.did) {
        return NextResponse.json(data, {
          headers: {
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
          },
        });
      }
    }
  } catch {
    // Backend unavailable — fall through to demo data
  }

  // Fallback: build profile from demo SCITT entries
  const profile = buildDemoProfile(domain);
  if (!profile) {
    return NextResponse.json(
      { error: "No CPOEs found for this issuer" },
      { status: 404 },
    );
  }

  return NextResponse.json(profile, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
    },
  });
}
