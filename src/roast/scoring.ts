import type { RoastScoredCheck, RoastVerdict } from "./types";

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(10, score));
}

function roundOne(score: number): number {
  return Math.round(score * 10) / 10;
}

export function calculateCompositeScore(checks: RoastScoredCheck[]): number {
  if (checks.length === 0) return 0;
  const total = checks.reduce((sum, check) => sum + clampScore(check.score), 0);
  return roundOne(total / checks.length);
}

export function calculateVerdict(score: number): RoastVerdict {
  if (score >= 9.0) return "CORSAIR READY";
  if (score >= 8.0) return "VERIFICATION READY";
  if (score >= 6.0) return "GETTING THERE";
  if (score >= 4.0) return "TRUST ME BRO";
  if (score >= 2.0) return "PDF HOARDER";
  return "COMPLIANCE GHOST";
}

export function normalizeScore(score: number): number {
  return roundOne(clampScore(score));
}
