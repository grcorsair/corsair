import type { RoastScoredCheck } from "../types";
import type { RoastScanContext } from "../scanner-types";
import { normalizeScore } from "../scoring";

export async function checkDiscoverability(ctx: RoastScanContext): Promise<RoastScoredCheck> {
  const findings: string[] = [];
  let score = 0;

  const pageCount = ctx.pageSignals.length;
  if (pageCount > 0) {
    score += 4;
    findings.push(`${pageCount} trust-center page(s) crawled`);

    const keywordUniverse = new Set<string>();
    for (const page of ctx.pageSignals) {
      for (const keyword of page.keywordHits) keywordUniverse.add(keyword);
    }

    if (keywordUniverse.has("trust") || keywordUniverse.has("security") || keywordUniverse.has("compliance")) {
      score += 2;
      findings.push("Trust/security/compliance language found on public pages");
    }

    const docsPage = ctx.pageSignals.find((page) =>
      page.url.toLowerCase().includes("trust") || page.url.toLowerCase().includes("security"),
    );
    if (docsPage) {
      score += 1;
      findings.push(`Trust-center style landing page found: ${docsPage.url}`);
    }
  } else {
    findings.push("No crawlable trust-center pages found");
  }

  const trustTxt = ctx.trustResolution.trustTxt;
  if (trustTxt) {
    score += 1;
    findings.push(`trust.txt found at ${ctx.trustResolution.url || "/.well-known/trust.txt"}`);

    if (trustTxt.did) {
      score += 0.5;
      findings.push(`DID present: ${trustTxt.did}`);
    } else {
      findings.push("DID missing from trust.txt");
    }

    if (trustTxt.cpoes.length > 0) {
      score += 0.5;
      findings.push(`${trustTxt.cpoes.length} CPOE URL(s) listed`);
    }
  } else {
    findings.push("No trust.txt found at /.well-known/trust.txt (or delegated DNS)");
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
