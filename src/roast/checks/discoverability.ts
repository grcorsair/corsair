import type { RoastScoredCheck } from "../types";
import type { RoastScanContext } from "../scanner-types";
import { normalizeScore } from "../scoring";

export async function checkDiscoverability(ctx: RoastScanContext): Promise<RoastScoredCheck> {
  const findings: string[] = [];
  let score = 0;

  const trustTxt = ctx.trustResolution.trustTxt;
  if (trustTxt) {
    score += 4;
    findings.push(`trust.txt found at ${ctx.trustResolution.url || "/.well-known/trust.txt"}`);

    if (trustTxt.did) {
      score += 1;
      findings.push(`DID present: ${trustTxt.did}`);
    } else {
      findings.push("DID missing from trust.txt");
    }

    if (trustTxt.cpoes.length > 0) {
      score += 1;
      findings.push(`${trustTxt.cpoes.length} CPOE URL(s) listed`);
    } else {
      findings.push("No CPOE URLs listed in trust.txt");
    }

    if (trustTxt.scitt) {
      score += 1;
      findings.push("SCITT endpoint declared");
    }
    if (trustTxt.flagship) {
      score += 0.5;
      findings.push("FLAGSHIP endpoint declared");
    }
    if (trustTxt.frameworks.length > 0) {
      score += 0.5;
      findings.push(`Frameworks listed: ${trustTxt.frameworks.join(", ")}`);
    }
    if (trustTxt.contact) {
      score += 0.5;
      findings.push("Contact listed");
    }
    if (trustTxt.expires) {
      score += 0.5;
      findings.push("Expires field present");
    }
  } else {
    findings.push("No trust.txt found at /.well-known/trust.txt (or delegated DNS)");

    const fetchFn = ctx.deps.fetchFn || globalThis.fetch;
    for (const path of ["/trust", "/security", "/compliance"]) {
      try {
        const res = await fetchFn(`https://${ctx.domain}${path}`, {
          method: "GET",
          signal: AbortSignal.timeout(4000),
          redirect: "error",
        });
        if (res.ok) {
          score += 1;
          findings.push(`Fallback page discovered at ${path}`);
          break;
        }
      } catch {
        // Ignore and continue fallback probes
      }
    }
  }

  const fetchFn = ctx.deps.fetchFn || globalThis.fetch;
  try {
    const securityRes = await fetchFn(`https://${ctx.domain}/.well-known/security.txt`, {
      method: "GET",
      signal: AbortSignal.timeout(4000),
      redirect: "error",
    });
    if (securityRes.ok) {
      score += 0.5;
      findings.push("security.txt present");
    } else {
      findings.push("security.txt not found");
    }
  } catch {
    findings.push("security.txt unreachable");
  }

  return {
    category: "discoverability",
    score: normalizeScore(score),
    findings,
  };
}
