/**
 * Gap Analysis Runner — precision-recall on missing controls
 *
 * Calculates precision, recall, and F1 on arrays of missing control IDs.
 * Score = F1 * 100.
 * Uses the same precision-recall math as control-mapping but on missingControls field.
 */

import type { ScoringConfig } from "../types";
import { calculatePrecisionRecallF1 } from "./control-mapping-runner";

export function scoreGapAnalysis(
  output: unknown,
  expected: unknown,
  config: ScoringConfig
): { score: number; details: Record<string, unknown> } {
  const outputIds = extractIds(output, "missingControls");
  const expectedIds = extractIds(expected, "missingControls");

  const { precision, recall, f1 } = calculatePrecisionRecallF1(outputIds, expectedIds);

  const score = Math.round(f1 * 100 * 100) / 100;

  return {
    score,
    details: {
      precision: Math.round(precision * 1000) / 1000,
      recall: Math.round(recall * 1000) / 1000,
      f1: Math.round(f1 * 1000) / 1000,
      outputCount: outputIds.size,
      expectedCount: expectedIds.size,
    },
  };
}

function extractIds(obj: unknown, key: string): Set<string> {
  if (obj == null || typeof obj !== "object") return new Set();
  const arr = (obj as Record<string, unknown>)[key];
  if (!Array.isArray(arr)) return new Set();
  return new Set(arr.map(String));
}
