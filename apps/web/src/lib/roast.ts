export type RoastCategory =
  | "discoverability"
  | "verifiability"
  | "freshness"
  | "machine-readability"
  | "transparency";

export interface RoastCheck {
  category: RoastCategory;
  score: number;
  findings: string[];
  roast: string;
}

export type RoastVerdict =
  | "COMPLIANCE GHOST"
  | "PDF HOARDER"
  | "TRUST ME BRO"
  | "GETTING THERE"
  | "VERIFICATION READY"
  | "CORSAIR READY";

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

export interface RoastError {
  error: string;
  code?: "INVALID_DOMAIN" | "RATE_LIMITED" | "SCAN_FAILED" | "NOT_FOUND";
}

export const ROAST_CATEGORY_LABEL: Record<RoastCategory, string> = {
  discoverability: "Discoverability",
  verifiability: "Verifiability",
  freshness: "Freshness",
  "machine-readability": "Machine Readability",
  transparency: "Transparency",
};

export function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/\.$/, "");
}

export function isValidDomain(domain: string): boolean {
  if (!domain || domain.length > 253) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(domain)) return false;
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/.test(domain);
}

export function verdictTone(verdict: RoastVerdict): string {
  if (verdict === "CORSAIR READY" || verdict === "VERIFICATION READY") {
    return "text-corsair-green border-corsair-green/30";
  }
  if (verdict === "GETTING THERE") {
    return "text-corsair-gold border-corsair-gold/30";
  }
  if (verdict === "TRUST ME BRO") {
    return "text-corsair-cyan border-corsair-cyan/30";
  }
  return "text-corsair-crimson border-corsair-crimson/30";
}

export function scoreTone(score: number): string {
  if (score >= 8.5) return "bg-corsair-green";
  if (score >= 6.5) return "bg-corsair-gold";
  if (score >= 4.5) return "bg-corsair-cyan";
  return "bg-corsair-crimson";
}
