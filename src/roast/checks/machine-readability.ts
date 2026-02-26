import type { RoastScoredCheck } from "../types";
import type { RoastScanContext } from "../scanner-types";
import { normalizeScore } from "../scoring";

export async function checkMachineReadability(ctx: RoastScanContext): Promise<RoastScoredCheck> {
  const findings: string[] = [];
  let score = 0;

  const trustTxt = ctx.trustResolution.trustTxt;
  if (trustTxt) {
    score += 2;
    findings.push("trust.txt is machine-readable");
  }

  if (ctx.cpoeListResolution.cpoes.length > 0) {
    score += 5;
    findings.push(`${ctx.cpoeListResolution.cpoes.length} JWT CPOE artifact(s) discovered`);
  }

  if (trustTxt?.catalog) {
    score += 1;
    findings.push("Catalog endpoint declared");
  }

  if (trustTxt?.scitt) {
    score += 1;
    findings.push("API-style SCITT endpoint declared");
  }

  // Lightweight fallback: if no structured artifacts exist, probe trust pages for obvious PDF-only signal.
  if (!trustTxt && ctx.cpoeListResolution.cpoes.length === 0) {
    const fetchFn = ctx.deps.fetchFn || globalThis.fetch;
    for (const path of ["/trust", "/security", "/compliance"]) {
      try {
        const res = await fetchFn(`https://${ctx.domain}${path}`, {
          method: "GET",
          signal: AbortSignal.timeout(4000),
          redirect: "error",
        });
        if (!res.ok) continue;
        const html = (await res.text()).toLowerCase();
        if (html.includes(".pdf")) {
          score += 0.5;
          findings.push(`Likely PDF-centric trust center at ${path}`);
          break;
        }
      } catch {
        // Ignore and continue probes
      }
    }
  }

  if (score === 0) {
    findings.push("No machine-readable compliance artifacts found");
  }

  return {
    category: "machine-readability",
    score: normalizeScore(score),
    findings,
  };
}
