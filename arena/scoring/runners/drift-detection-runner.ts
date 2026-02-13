/**
 * Drift Detection Runner — diff-match scoring
 *
 * Compares arrays of detected regressions against ground truth.
 * Score = recall * 50 + precision * 50.
 * Missing regressions are penalized (recall-weighted).
 */

import type { ScoringConfig } from "../types";

export function scoreDriftDetection(
  output: unknown,
  expected: unknown,
  config: ScoringConfig
): { score: number; details: Record<string, unknown> } {
  const outputRegressions = extractArray(output, "regressions");
  const expectedRegressions = extractArray(expected, "regressions");

  const outputSet = new Set(outputRegressions);
  const expectedSet = new Set(expectedRegressions);

  // Both empty = perfect
  if (outputSet.size === 0 && expectedSet.size === 0) {
    return {
      score: 100,
      details: {
        recall: 1.0,
        precision: 1.0,
        truePositives: 0,
        falsePositives: 0,
        falseNegatives: 0,
      },
    };
  }

  let truePositives = 0;
  for (const r of outputSet) {
    if (expectedSet.has(r)) truePositives++;
  }

  const falsePositives = outputSet.size - truePositives;
  const falseNegatives = expectedSet.size - truePositives;

  const precision = outputSet.size > 0 ? truePositives / outputSet.size : 0;
  const recall = expectedSet.size > 0 ? truePositives / expectedSet.size : 0;

  // Score = recall * 50 + precision * 50
  const score = Math.round((recall * 50 + precision * 50) * 100) / 100;

  return {
    score,
    details: {
      recall: Math.round(recall * 1000) / 1000,
      precision: Math.round(precision * 1000) / 1000,
      truePositives,
      falsePositives,
      falseNegatives,
    },
  };
}

function extractArray(obj: unknown, key: string): string[] {
  if (obj == null || typeof obj !== "object") return [];
  const arr = (obj as Record<string, unknown>)[key];
  if (!Array.isArray(arr)) return [];
  return arr.map(String);
}
