/**
 * Evidence Parsing Runner — json-field-match scoring
 *
 * Compares specific JSON field paths between agent output and ground truth.
 * Score = (matched fields / total fields) * 100.
 * Supports dot-notation paths (e.g., "summary.controlsPassed").
 */

import type { ScoringConfig } from "../types";

/**
 * Navigate a dot-notation path into an object.
 * Returns undefined if any segment is missing.
 */
function getNestedValue(obj: unknown, path: string): unknown {
  if (obj == null || typeof obj !== "object") return undefined;
  const segments = path.split(".");
  let current: unknown = obj;
  for (const segment of segments) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function scoreEvidenceParsing(
  output: unknown,
  expected: unknown,
  config: ScoringConfig
): { score: number; details: Record<string, unknown> } {
  const fields = config.fields ?? [];
  const totalFields = fields.length;

  if (totalFields === 0) {
    return {
      score: 0,
      details: { matchedFields: 0, totalFields: 0, fieldResults: {} },
    };
  }

  const fieldResults: Record<string, boolean> = {};
  let matchedFields = 0;

  for (const field of fields) {
    const outputValue = getNestedValue(output, field);
    const expectedValue = getNestedValue(expected, field);
    const match = outputValue === expectedValue;
    fieldResults[field] = match;
    if (match) matchedFields++;
  }

  let score: number;
  if (config.partialCredit) {
    score = (matchedFields / totalFields) * 100;
  } else {
    score = matchedFields === totalFields ? 100 : 0;
  }

  return {
    score: Math.round(score * 100) / 100,
    details: { matchedFields, totalFields, fieldResults },
  };
}
