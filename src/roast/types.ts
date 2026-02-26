export type RoastCategory =
  | "discoverability"
  | "verifiability"
  | "freshness"
  | "machine-readability"
  | "transparency";

export interface RoastScoredCheck {
  category: RoastCategory;
  score: number;
  findings: string[];
}

export interface RoastCheck extends RoastScoredCheck {
  roast: string;
}

export type RoastVerdict =
  | "COMPLIANCE GHOST"
  | "PDF HOARDER"
  | "TRUST ME BRO"
  | "GETTING THERE"
  | "VERIFICATION READY"
  | "CORSAIR READY";

export interface RoastScanResult {
  domain: string;
  compositeScore: number;
  verdict: RoastVerdict;
  checks: RoastScoredCheck[];
}

export interface RoastResult {
  id: string;
  domain: string;
  compositeScore: number;
  verdict: RoastVerdict;
  checks: RoastCheck[];
  summaryRoast: string;
  fixPreview: string;
  trustTxtExample: string;
  createdAt: string;
}

export interface RoastRequest {
  domain: string;
}

export interface RoastError {
  error: string;
  code: "INVALID_DOMAIN" | "RATE_LIMITED" | "SCAN_FAILED" | "NOT_FOUND";
}

export interface RoastCopyInput {
  domain: string;
  compositeScore: number;
  verdict: RoastVerdict;
  checks: RoastScoredCheck[];
}

export interface RoastCopyOutput {
  categoryRoasts: Record<RoastCategory, string>;
  summaryRoast: string;
  fixPreview: string;
}
