/**
 * GRC Model Arena — Scoring Engine
 *
 * Main dispatcher that routes challenges to category-specific scoring functions
 * based on the challenge's scoring method.
 */

import type { Challenge, ChallengeResult } from "./types";
import { scoreEvidenceParsing } from "./runners/evidence-parsing-runner";
import { scoreControlMapping } from "./runners/control-mapping-runner";
import { scoreCPOEGeneration } from "./runners/cpoe-generation-runner";
import { scoreDriftDetection } from "./runners/drift-detection-runner";
import { scoreGapAnalysis } from "./runners/gap-analysis-runner";

const PASS_THRESHOLD = 70;

/**
 * Score a challenge by dispatching to the appropriate category runner.
 *
 * @param challenge - The challenge definition with scoring config
 * @param agentOutput - The agent's output (parsed JSON)
 * @param groundTruth - The expected output / ground truth (parsed JSON)
 * @returns ChallengeResult with score, pass/fail, and details
 */
export function scoreChallenge(
  challenge: Challenge,
  agentOutput: unknown,
  groundTruth: unknown
): ChallengeResult {
  const { scoring } = challenge;

  let result: { score: number; details: Record<string, unknown> };

  switch (scoring.method) {
    case "json-field-match":
      result = scoreEvidenceParsing(agentOutput, groundTruth, scoring);
      break;
    case "precision-recall":
      result = scoreControlMapping(agentOutput, groundTruth, scoring);
      break;
    case "cpoe-verify":
      result = scoreCPOEGeneration(agentOutput, groundTruth, scoring);
      break;
    case "diff-match":
      result = scoreDriftDetection(agentOutput, groundTruth, scoring);
      break;
    default: {
      const _exhaustive: never = scoring.method;
      result = { score: 0, details: { error: `Unknown method: ${_exhaustive}` } };
    }
  }

  return {
    challengeId: challenge.id,
    agentModel: "",
    score: result.score,
    passed: result.score >= PASS_THRESHOLD,
    timeSeconds: 0,
    attempt: 1,
    details: result.details,
  };
}
