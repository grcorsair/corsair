import type { RoastScoredCheck } from "../types";
import type { RoastScanContext } from "../scanner-types";
import { normalizeScore } from "../scoring";

function parseDate(value?: string): number {
  if (!value) return 0;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? 0 : ts;
}

function decodeIat(jwt: string): number {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return 0;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString()) as { iat?: number };
    return typeof payload.iat === "number" ? payload.iat * 1000 : 0;
  } catch {
    return 0;
  }
}

function scoreByAgeDays(ageDays: number): number {
  if (ageDays < 7) return 10;
  if (ageDays < 30) return 8;
  if (ageDays < 90) return 6;
  if (ageDays < 180) return 4;
  if (ageDays < 365) return 2;
  return 0.5;
}

export async function checkFreshness(ctx: RoastScanContext): Promise<RoastScoredCheck> {
  const findings: string[] = [];
  const now = (ctx.deps.now || (() => new Date()))().getTime();

  let newest = 0;
  for (const cpoe of ctx.cpoeListResolution.cpoes) {
    newest = Math.max(newest, parseDate(cpoe.issuedAt), parseDate(cpoe.expiresAt));
  }

  if (newest === 0 && ctx.deps.fetchCpoeJwt) {
    for (const cpoe of ctx.cpoeListResolution.cpoes.slice(0, 3)) {
      const fetched = await ctx.deps.fetchCpoeJwt(cpoe.url, ctx.deps.fetchFn);
      if (fetched.jwt) {
        newest = Math.max(newest, decodeIat(fetched.jwt));
      }
    }
  }

  let score = 0;
  if (newest > 0) {
    const ageDays = Math.max(0, Math.floor((now - newest) / (24 * 60 * 60 * 1000)));
    score = scoreByAgeDays(ageDays);
    findings.push(`Most recent evidence appears ${ageDays} day(s) old`);
  } else {
    findings.push("No datable evidence found");
  }

  const expires = ctx.trustResolution.trustTxt?.expires;
  const expiresTs = parseDate(expires);
  if (expiresTs > now) {
    score += 0.5;
    findings.push("trust.txt expires field is in the future");
  } else if (expiresTs > 0 && expiresTs <= now) {
    score = score * 0.5;
    findings.push("trust.txt is expired");
  }

  return {
    category: "freshness",
    score: normalizeScore(score),
    findings,
  };
}
