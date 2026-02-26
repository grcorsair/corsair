import { resolveTrustTxt } from "../parley/trust-txt";
import { resolveCpoeList } from "../parley/cpoe-resolver";
import { fetchCpoeJwt } from "../parley/cpoe-resolver";
import { verifyVCJWTViaDID } from "../parley/vc-verifier";
import { resolveDIDDocument } from "../parley/did-resolver";
import { resolveScittEntries } from "../parley/scitt-client";
import { calculateCompositeScore, calculateVerdict } from "./scoring";
import { checkDiscoverability } from "./checks/discoverability";
import { checkVerifiability } from "./checks/verifiability";
import { checkFreshness } from "./checks/freshness";
import { checkMachineReadability } from "./checks/machine-readability";
import { checkTransparency } from "./checks/transparency";
import type { RoastScanResult, RoastScoredCheck } from "./types";
import type { RoastScannerDeps } from "./scanner-types";

async function safeCheck(
  runner: () => Promise<RoastScoredCheck>,
  fallback: RoastScoredCheck,
): Promise<RoastScoredCheck> {
  try {
    return await runner();
  } catch (err) {
    return {
      ...fallback,
      findings: [
        ...fallback.findings,
        `Check failed: ${err instanceof Error ? err.message : "unknown error"}`,
      ],
    };
  }
}

export async function scanDomain(
  domain: string,
  deps: RoastScannerDeps = {},
): Promise<RoastScanResult> {
  const doResolveTrustTxt = deps.resolveTrustTxt ?? resolveTrustTxt;
  const doResolveCpoeList = deps.resolveCpoeList ?? resolveCpoeList;

  const trustResolution = await doResolveTrustTxt(domain, {
    fetchFn: deps.fetchFn,
  });

  let cpoeListResolution;
  if (trustResolution.trustTxt) {
    cpoeListResolution = await doResolveCpoeList(domain, {
      fetchFn: deps.fetchFn,
      resolveTrustTxt: async () => trustResolution,
    });
  } else {
    cpoeListResolution = {
      cpoes: [],
      source: "trust-txt" as const,
      error: trustResolution.error || "trust.txt unavailable",
    };
  }

  const ctx = {
    domain,
    trustResolution,
    cpoeListResolution,
    deps: {
      ...deps,
      fetchCpoeJwt: deps.fetchCpoeJwt ?? fetchCpoeJwt,
      verifyVCJWTViaDID: deps.verifyVCJWTViaDID ?? verifyVCJWTViaDID,
      resolveDIDDocument: deps.resolveDIDDocument ?? resolveDIDDocument,
      resolveScittEntries: deps.resolveScittEntries ?? resolveScittEntries,
    },
  };

  const checks = await Promise.all([
    safeCheck(
      () => checkDiscoverability(ctx),
      {
        category: "discoverability",
        score: 0,
        findings: ["Discoverability check failed"],
      },
    ),
    safeCheck(
      () => checkVerifiability(ctx),
      {
        category: "verifiability",
        score: 0,
        findings: ["Verifiability check failed"],
      },
    ),
    safeCheck(
      () => checkFreshness(ctx),
      {
        category: "freshness",
        score: 0,
        findings: ["Freshness check failed"],
      },
    ),
    safeCheck(
      () => checkMachineReadability(ctx),
      {
        category: "machine-readability",
        score: 0,
        findings: ["Machine-readability check failed"],
      },
    ),
    safeCheck(
      () => checkTransparency(ctx),
      {
        category: "transparency",
        score: 0,
        findings: ["Transparency check failed"],
      },
    ),
  ]);

  const compositeScore = calculateCompositeScore(checks);
  const verdict = calculateVerdict(compositeScore);

  return {
    domain,
    checks,
    compositeScore,
    verdict,
  };
}
