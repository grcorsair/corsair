/**
 * Control Mapping Runner — precision-recall scoring
 *
 * Calculates precision, recall, and F1 on arrays of control IDs.
 * Score = F1 * 100.
 * Duplicates in output are deduplicated before scoring.
 */

import type { ScoringConfig } from "../types";

export function scoreControlMapping(
  output: unknown,
  expected: unknown,
  config: ScoringConfig
): { score: number; details: Record<string, unknown> } {
  const outputIds = extractIds(output, "controlIds");
  const expectedIds = extractIds(expected, "controlIds");

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

export function calculatePrecisionRecallF1(
  predicted: Set<string>,
  actual: Set<string>
): { precision: number; recall: number; f1: number } {
  // Both empty = perfect match
  if (predicted.size === 0 && actual.size === 0) {
    return { precision: 1, recall: 1, f1: 1 };
  }

  // Predicted empty, actual non-empty
  if (predicted.size === 0) {
    return { precision: 0, recall: 0, f1: 0 };
  }

  // Predicted non-empty, actual empty
  if (actual.size === 0) {
    return { precision: 0, recall: 1, f1: 0 };
  }

  let truePositives = 0;
  for (const id of predicted) {
    if (actual.has(id)) truePositives++;
  }

  const precision = truePositives / predicted.size;
  const recall = truePositives / actual.size;

  if (precision + recall === 0) {
    return { precision: 0, recall: 0, f1: 0 };
  }

  const f1 = (2 * precision * recall) / (precision + recall);

  return { precision, recall, f1 };
}
