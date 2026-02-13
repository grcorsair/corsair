import { NextRequest, NextResponse } from "next/server";
import demoEntries from "../../../../public/demo-scitt-entries.json";

const API_BASE = process.env.CORSAIR_API_URL ?? "https://api.grcorsair.com";

interface DemoEntry {
  entryId: string;
  registrationTime: string;
  treeSize: number;
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

/**
 * Apply query params to demo data (client-side filtering).
 * Mirrors the backend's filtering behavior.
 */
function filterDemoEntries(
  entries: DemoEntry[],
  params: URLSearchParams,
): DemoEntry[] {
  let filtered = [...entries];

  const issuer = params.get("issuer");
  if (issuer) {
    filtered = filtered.filter((e) => e.issuer === issuer);
  }

  const framework = params.get("framework");
  if (framework) {
    filtered = filtered.filter((e) =>
      e.scope.toLowerCase().includes(framework.toLowerCase()),
    );
  }

  const provenanceSource = params.get("provenanceSource");
  if (provenanceSource) {
    filtered = filtered.filter((e) => e.provenance.source === provenanceSource);
  }

  const offset = parseInt(params.get("offset") ?? "0", 10) || 0;
  const limit = parseInt(params.get("limit") ?? "20", 10) || 20;

  return filtered.slice(offset, offset + limit);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const params = new URLSearchParams();
  const limit = searchParams.get("limit") ?? "20";
  const offset = searchParams.get("offset") ?? "0";
  params.set("limit", limit);
  params.set("offset", offset);

  const issuer = searchParams.get("issuer");
  if (issuer) params.set("issuer", issuer);

  const framework = searchParams.get("framework");
  if (framework) params.set("framework", framework);

  const provenanceSource = searchParams.get("provenanceSource");
  if (provenanceSource) params.set("provenanceSource", provenanceSource);

  try {
    const res = await fetch(`${API_BASE}/scitt/entries?${params.toString()}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 30 },
    });

    if (res.ok) {
      const data = await res.json();
      // Backend may return { entries: [...], pagination: {...} } or a flat array
      const entries = Array.isArray(data) ? data : (data.entries ?? []);
      // If backend has real data, serve it; otherwise fall through to demo data
      if (entries.length > 0) {
        return NextResponse.json(entries, {
          headers: {
            "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
          },
        });
      }
    }
  } catch {
    // Backend unavailable — fall through to demo data
  }

  // Fallback: serve demo data (real signed CPOEs from example evidence files)
  const filtered = filterDemoEntries(demoEntries as DemoEntry[], params);
  return NextResponse.json(filtered, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
    },
  });
}
