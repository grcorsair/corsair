import type { RoastScoredCheck } from "../types";
import type { RoastScanContext } from "../scanner-types";
import { normalizeScore } from "../scoring";

export async function checkVerifiability(ctx: RoastScanContext): Promise<RoastScoredCheck> {
  const findings: string[] = [];
  let score = 0;

  const trustTxt = ctx.trustResolution.trustTxt;
  const cpoes = ctx.cpoeListResolution.cpoes;
  if (cpoes.length === 0) {
    const keywordUniverse = new Set<string>();
    for (const page of ctx.pageSignals) {
      for (const keyword of page.keywordHits) keywordUniverse.add(keyword);
    }

    const claimsTrust = keywordUniverse.has("soc 2") || keywordUniverse.has("iso 27001") || keywordUniverse.has("audit");
    if (claimsTrust) {
      score += 3;
      findings.push("Trust claims found (SOC 2 / ISO / audit language) on trust-center pages");
      findings.push("No cryptographically verifiable CPOEs discovered yet");
    } else {
      findings.push("No signed CPOEs discovered and no clear attestations found on crawled pages");
    }
  }

  const doFetchCpoeJwt = ctx.deps.fetchCpoeJwt;
  const doVerify = ctx.deps.verifyVCJWTViaDID;
  const doResolveDid = ctx.deps.resolveDIDDocument;

  if (cpoes.length > 0) {
    if (!doFetchCpoeJwt || !doVerify) {
      findings.push("Verification dependencies unavailable");
    } else {
      const maxCpoes = Math.max(1, Math.min(ctx.deps.maxCpoes ?? 5, 10));
      const toCheck = cpoes.slice(0, maxCpoes);

      let validCount = 0;
      for (const cpoe of toCheck) {
        const fetched = await doFetchCpoeJwt(cpoe.url, ctx.deps.fetchFn);
        if (!fetched.jwt) {
          findings.push(`CPOE unreachable or unreadable: ${cpoe.url}${fetched.error ? ` (${fetched.error})` : ""}`);
          continue;
        }

        const verification = await doVerify(fetched.jwt, ctx.deps.fetchFn);
        if (verification.valid) {
          validCount++;
          findings.push(`CPOE signature valid: ${cpoe.url}`);
        } else {
          findings.push(`CPOE signature invalid: ${cpoe.url}`);
        }
      }

      if (validCount > 0) {
        const ratio = validCount / toCheck.length;
        score += 6 * ratio;
      }
    }
  }

  if (trustTxt?.did && doResolveDid) {
    const didResolution = await doResolveDid(trustTxt.did, ctx.deps.fetchFn);
    if (didResolution.didDocument) {
      score += 1.5;
      findings.push(`DID resolves: ${trustTxt.did}`);
    } else {
      findings.push(`DID failed to resolve: ${trustTxt.did}`);
    }
  }

  if (cpoes.length >= 2) {
    score += 1;
    findings.push(`${cpoes.length} CPOEs published`);
  }

  if ((trustTxt?.frameworks.length || 0) >= 2) {
    score += 0.5;
    findings.push("Multiple frameworks represented");
  }

  return {
    category: "verifiability",
    score: normalizeScore(score),
    findings,
  };
}
