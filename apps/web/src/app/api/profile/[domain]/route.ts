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
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (res.status === 404) {
      return NextResponse.json(
        { error: "No CPOEs found for this issuer" },
        { status: 404 },
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${res.status}` },
        { status: res.status },
      );
    }

    const data = await res.json();

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch profile" },
      { status: 502 },
    );
  }
}
