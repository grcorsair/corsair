import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.CORSAIR_API_URL ?? "https://api.grcorsair.com";

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
    // Backend unavailable — fall through to 404
  }

  return NextResponse.json(
    { error: "No CPOEs found for this issuer" },
    { status: 404 },
  );
}
