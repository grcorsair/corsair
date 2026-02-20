import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.CORSAIR_API_URL ?? "https://api.grcorsair.com";

interface SCITTEntry {
  entryId: string;
  registrationTime: string;
  treeSize: number;
  issuer: string;
  scope: string;
  provenance: { source: string; sourceIdentity?: string };
  summary?: {
    controlsTested: number;
    controlsPassed: number;
    controlsFailed: number;
    overallScore: number;
  };
}

/**
 * Proxy SCITT entries from the API.
 * Returns an empty list if backend is unavailable.
 */
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
      const entries = Array.isArray(data) ? data : (data.entries ?? []);
      return NextResponse.json(entries as SCITTEntry[], {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      });
    }
  } catch {
    // Backend unavailable — fall through to empty list
  }

  return NextResponse.json([], {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
    },
  });
}
