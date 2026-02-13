/**
 * CPOE Generation Runner — cpoe-verify scoring
 *
 * Validates agent output as a JWT-VC:
 *   - 50 points: Valid JWT format (3 base64url segments, decodable)
 *   - 25 points: Schema match (credentialSubject.type === expected)
 *   - 25 points: Summary accuracy (all summary fields match)
 */

import type { ScoringConfig } from "../types";

/**
 * Check if a string is valid base64url (permissive — allows padding).
 */
function isBase64Url(str: string): boolean {
  return /^[A-Za-z0-9_-]+={0,2}$/.test(str);
}

/**
 * Decode a base64url string to a parsed JSON object.
 * Returns null if decoding or parsing fails.
 */
function decodeBase64UrlJson(str: string): Record<string, unknown> | null {
  try {
    // Add padding if needed
    const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
    const decoded = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function scoreCPOEGeneration(
  output: unknown,
  expected: unknown,
  config: ScoringConfig
): { score: number; details: Record<string, unknown> } {
  // Extract JWT string from output
  const jwt = extractJwt(output);
  if (!jwt) {
    return {
      score: 0,
      details: { validJwt: false, schemaMatch: false, summaryAccurate: false },
    };
  }

  // Check valid JWT format: 3 base64url segments
  const segments = jwt.split(".");
  if (segments.length !== 3 || !segments.every(isBase64Url)) {
    return {
      score: 0,
      details: { validJwt: false, schemaMatch: false, summaryAccurate: false },
    };
  }

  // Decode payload
  const payload = decodeBase64UrlJson(segments[1]);
  if (!payload) {
    return {
      score: 0,
      details: { validJwt: false, schemaMatch: false, summaryAccurate: false },
    };
  }

  let score = 50; // Valid JWT = 50 points
  const details: Record<string, unknown> = {
    validJwt: true,
    schemaMatch: false,
    summaryAccurate: false,
  };

  // Check schema match
  const vc = payload.vc as Record<string, unknown> | undefined;
  const subject = vc?.credentialSubject as Record<string, unknown> | undefined;
  const expectedObj = expected as Record<string, unknown> | undefined;
  const expectedSubject = expectedObj?.credentialSubject as
    | Record<string, unknown>
    | undefined;

  if (subject && expectedSubject && subject.type === expectedSubject.type) {
    details.schemaMatch = true;
    score += 25;

    // Check summary accuracy
    const outputSummary = subject.summary as Record<string, unknown> | undefined;
    const expectedSummary = expectedSubject.summary as
      | Record<string, unknown>
      | undefined;

    if (outputSummary && expectedSummary) {
      const summaryMatch = Object.keys(expectedSummary).every(
        (key) => outputSummary[key] === expectedSummary[key]
      );
      if (summaryMatch) {
        details.summaryAccurate = true;
        score += 25;
      }
    }
  }

  return { score, details };
}

function extractJwt(output: unknown): string | null {
  if (output == null || typeof output !== "object") return null;
  const jwt = (output as Record<string, unknown>).jwt;
  if (typeof jwt !== "string") return null;
  return jwt;
}
