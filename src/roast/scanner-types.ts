import type { FetchLike } from "../types/fetch";
import type { resolveTrustTxt, TrustTxtResolution } from "../parley/trust-txt";
import type { resolveCpoeList, fetchCpoeJwt, CpoeListResolution } from "../parley/cpoe-resolver";
import type { verifyVCJWTViaDID } from "../parley/vc-verifier";
import type { resolveDIDDocument } from "../parley/did-resolver";
import type { resolveScittEntries } from "../parley/scitt-client";
import type { crawlTrustCenter } from "./crawl";
import type { RoastPageSignal } from "./types";

export interface RoastScannerDeps {
  resolveTrustTxt?: typeof resolveTrustTxt;
  resolveCpoeList?: typeof resolveCpoeList;
  fetchCpoeJwt?: typeof fetchCpoeJwt;
  verifyVCJWTViaDID?: typeof verifyVCJWTViaDID;
  resolveDIDDocument?: typeof resolveDIDDocument;
  resolveScittEntries?: typeof resolveScittEntries;
  crawlTrustCenter?: typeof crawlTrustCenter;
  fetchFn?: FetchLike;
  now?: () => Date;
  maxCpoes?: number;
  maxCrawlPages?: number;
}

export interface RoastScanContext {
  domain: string;
  pageSignals: RoastPageSignal[];
  trustResolution: TrustTxtResolution;
  cpoeListResolution: CpoeListResolution;
  deps: RoastScannerDeps;
}
