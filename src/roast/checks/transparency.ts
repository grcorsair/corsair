import type { RoastScoredCheck } from "../types";
import type { RoastScanContext } from "../scanner-types";
import { normalizeScore } from "../scoring";

export async function checkTransparency(ctx: RoastScanContext): Promise<RoastScoredCheck> {
  const findings: string[] = [];
  let score = 0;

  const trustTxt = ctx.trustResolution.trustTxt;
  if (trustTxt?.scitt) {
    score += 3;
    findings.push("SCITT endpoint declared in trust.txt");

    if (ctx.deps.resolveScittEntries) {
      const scitt = await ctx.deps.resolveScittEntries(trustTxt.scitt, ctx.deps.fetchFn);
      if (scitt.entries.length > 0) {
        score += 3;
        findings.push(`SCITT endpoint returned ${scitt.entries.length} entr${scitt.entries.length === 1 ? "y" : "ies"}`);
        if (scitt.entries.length > 2) {
          score += 1.5;
          findings.push("Attestation history depth is greater than 2 entries");
        }
      } else {
        findings.push(scitt.error || "SCITT endpoint has no entries");
      }
    } else {
      findings.push("SCITT resolver unavailable");
    }
  } else {
    findings.push("No SCITT endpoint declared");
  }

  if (trustTxt?.flagship) {
    score += 1.5;
    findings.push("FLAGSHIP stream endpoint declared");
  }

  const fetchFn = ctx.deps.fetchFn || globalThis.fetch;
  try {
    const changelogRes = await fetchFn(`https://${ctx.domain}/changelog`, {
      method: "GET",
      signal: AbortSignal.timeout(4000),
      redirect: "error",
    });
    if (changelogRes.ok) {
      score += 1;
      findings.push("Public changelog endpoint found");
    }
  } catch {
    // Optional signal only
  }

  return {
    category: "transparency",
    score: normalizeScore(score),
    findings,
  };
}
