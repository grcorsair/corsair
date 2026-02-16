import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.CORSAIR_API_URL ?? "https://api.grcorsair.com";

// Rate limiting: 10 demo signs/min, 5 signed/min per IP
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, limit: number): boolean {
  const now = Date.now();
  const entry = rateLimits.get(ip);

  if (!entry || entry.resetAt < now) {
    rateLimits.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";

  try {
    const body = await request.json();
    const isDemo = !body.apiKey;
    const limit = isDemo ? 10 : 5;

    if (!checkRateLimit(`${ip}:${isDemo ? "demo" : "sign"}`, limit)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again in 60 seconds." },
        { status: 429 },
      );
    }

    if (!body.evidence) {
      return NextResponse.json(
        { error: "Missing 'evidence' field in request body." },
        { status: 400 },
      );
    }

    const endpoint = isDemo ? "/sign/demo" : "/sign";
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(body.apiKey ? { Authorization: `Bearer ${body.apiKey}` } : {}),
      },
      body: JSON.stringify({
        evidence: body.evidence,
        format: body.format,
        scope: body.scope,
        did: body.did,
        expiryDays: body.expiryDays,
        dryRun: body.dryRun,
      }),
    });

    const data = await res.json();
    if (isDemo && res.status === 503 && data?.error) {
      data.error = "Demo signing unavailable. Set CORSAIR_DEMO_PUBLIC_KEY and CORSAIR_DEMO_PRIVATE_KEY on the API.";
    }
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
