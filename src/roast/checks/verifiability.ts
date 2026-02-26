import type { RoastScoredCheck } from "../types";
import type { RoastScanContext } from "../scanner-types";
import { normalizeScore } from "../scoring";

export async function checkVerifiability(ctx: RoastScanContext): Promise<RoastScoredCheck> {
  const findings: string[] = [];
  let score = 0;

  const trustTxt = ctx.trustResolution.trustTxt;
  const cpoes = ctx.cpoeListResolution.cpoes;
  if (cpoes.length === 0) {
    findings.push("No signed CPOEs discovered");
    return {
      category: "verifiability",
      score: 0,
      findings,
    };
  }

  const doFetchCpoeJwt = ctx.deps.fetchCpoeJwt;
  const doVerify = ctx.deps.verifyVCJWTViaDID;
  const doResolveDid = ctx.deps.resolveDIDDocument;

  if (!doFetchCpoeJwt || !doVerify) {
    findings.push("Verification dependencies unavailable");
    return {
      category: "verifiability",
      score: 0,
      findings,
    };
  }

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
    score += 4 * ratio;
    score += 2 * ratio;
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
