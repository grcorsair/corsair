import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.CORSAIR_API_URL ?? "https://api.grcorsair.com";
const RATE_LIMIT_PER_MINUTE = 4;

const rateLimits = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function checkRateLimit(key: string, limit: number): boolean {
  const now = Date.now();
  const entry = rateLimits.get(key);

  if (!entry || entry.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  if (!checkRateLimit(`grc-translate:${ip}`, RATE_LIMIT_PER_MINUTE)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in 60 seconds." },
      { status: 429 },
    );
  }

  let body: {
    payload?: unknown;
    mode?: unknown;
    models?: unknown;
    style?: unknown;
    redact?: unknown;
    audience?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || body.payload === undefined) {
    return NextResponse.json({ error: "Missing payload." }, { status: 400 });
  }

  const forwardBody = {
    payload: body.payload,
    mode: body.mode,
    models: body.models,
    style: body.style,
    redact: body.redact,
    audience: body.audience,
  };

  try {
    const res = await fetch(`${API_BASE}/grc/translate`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(forwardBody),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });

    const data = await res.json().catch(() => ({ error: res.statusText }));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === "TimeoutError" || err.name === "AbortError")
    ) {
      return NextResponse.json({ error: "Translator request timed out." }, { status: 504 });
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
