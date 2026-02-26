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

  let statusLinks = 0;
  const keywordUniverse = new Set<string>();
  for (const page of ctx.pageSignals) {
    statusLinks += page.statusLinkCount;
    for (const keyword of page.keywordHits) keywordUniverse.add(keyword);
  }

  if (statusLinks > 0) {
    score += 2;
    findings.push(`${statusLinks} status/incident link(s) found`);
  }

  if (keywordUniverse.has("bug bounty")) {
    score += 1;
    findings.push("Bug bounty language present");
  }
  if (keywordUniverse.has("incident")) {
    score += 1;
    findings.push("Incident communication language present");
  }
  if (keywordUniverse.has("subprocessor")) {
    score += 1;
    findings.push("Subprocessor transparency language present");
  }

  return {
    category: "transparency",
    score: normalizeScore(score),
    findings,
  };
}
