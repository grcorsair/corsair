import type { FetchLike } from "../types/fetch";
import type { resolveTrustTxt, TrustTxtResolution } from "../parley/trust-txt";
import type { resolveCpoeList, fetchCpoeJwt, CpoeListResolution } from "../parley/cpoe-resolver";
import type { verifyVCJWTViaDID } from "../parley/vc-verifier";
import type { resolveDIDDocument } from "../parley/did-resolver";
import type { resolveScittEntries } from "../parley/scitt-client";

export interface RoastScannerDeps {
  resolveTrustTxt?: typeof resolveTrustTxt;
  resolveCpoeList?: typeof resolveCpoeList;
  fetchCpoeJwt?: typeof fetchCpoeJwt;
  verifyVCJWTViaDID?: typeof verifyVCJWTViaDID;
  resolveDIDDocument?: typeof resolveDIDDocument;
  resolveScittEntries?: typeof resolveScittEntries;
  fetchFn?: FetchLike;
  now?: () => Date;
  maxCpoes?: number;
}

export interface RoastScanContext {
  domain: string;
  trustResolution: TrustTxtResolution;
  cpoeListResolution: CpoeListResolution;
  deps: RoastScannerDeps;
}
