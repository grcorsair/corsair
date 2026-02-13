import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.CORSAIR_API_URL ?? "https://api.grcorsair.com";

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
      next: { revalidate: 30 }, // Cache for 30 seconds
    });

    if (!res.ok) {
      // Return empty array when upstream is unavailable (not deployed yet)
      return NextResponse.json([], {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      });
    }

    const data = await res.json();

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch {
    // Return empty array when upstream is unreachable
    return NextResponse.json([], {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  }
}
