/**
 * GRC Model Arena — Agent Execution Harness
 *
 * Runs benchmark challenges against an agent configuration.
 * Supports timeout enforcement, pass@N (best of N attempts),
 * and parallel execution.
 */

import type {
  AgentConfig,
  BenchmarkRun,
  Challenge,
  ChallengeResult,
} from "./types";
import { scoreChallenge } from "./score";

/**
 * Run a full benchmark suite against an agent.
 *
 * @param agent - Agent configuration (command, model, timeout)
 * @param challenges - Array of challenges to run
 * @param options - Optional: attempts (pass@N, default 1), parallel (concurrency, default 1)
 * @returns BenchmarkRun with all results and aggregate scores
 */
export async function runBenchmark(
  agent: AgentConfig,
  challenges: Challenge[],
  options?: { attempts?: number; parallel?: number }
): Promise<BenchmarkRun> {
  const attempts = options?.attempts ?? 1;
  const parallel = options?.parallel ?? 1;
  const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const date = new Date().toISOString();

  const results: ChallengeResult[] = [];

  // Process challenges with concurrency limit
  const queue = [...challenges];
  const running: Promise<void>[] = [];

  async function processChallenge(challenge: Challenge): Promise<void> {
    let bestResult: ChallengeResult | null = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      const result = await executeChallenge(agent, challenge, attempt);
      if (!bestResult || result.score > bestResult.score) {
        bestResult = result;
      }
      // Early exit if passed
      if (bestResult.passed) break;
    }

    if (bestResult) {
      bestResult.agentModel = agent.model;
      results.push(bestResult);
    }
  }

  // Simple concurrency limiter
  for (let i = 0; i < queue.length; i += parallel) {
    const batch = queue.slice(i, i + parallel);
    await Promise.all(batch.map(processChallenge));
  }

  // Calculate category scores (macro-average)
  const categoryScores = calculateCategoryScores(results);
  const categories = Object.values(categoryScores);
  const overallScore =
    categories.length > 0
      ? Math.round(
          (categories.reduce((sum, s) => sum + s, 0) / categories.length) * 100
        ) / 100
      : 0;

  return {
    runId,
    date,
    agentModel: agent.model,
    results,
    overallScore,
    categoryScores,
  };
}

/**
 * Execute a single challenge against an agent.
 * Runs the agent command with input, enforces timeout, and scores the output.
 */
async function executeChallenge(
  agent: AgentConfig,
  challenge: Challenge,
  attempt: number
): Promise<ChallengeResult> {
  const startTime = Date.now();

  try {
    // Read input and ground truth files
    const inputFile = Bun.file(challenge.input);
    const groundTruthFile = Bun.file(challenge.groundTruth);

    if (!(await inputFile.exists()) || !(await groundTruthFile.exists())) {
      return {
        challengeId: challenge.id,
        agentModel: agent.model,
        score: 0,
        passed: false,
        timeSeconds: 0,
        attempt,
        details: { error: "Input or ground truth file not found" },
      };
    }

    const input = await inputFile.text();
    const groundTruth = JSON.parse(await groundTruthFile.text());

    // Run agent command with timeout
    const timeout = Math.min(
      agent.timeout,
      challenge.timeLimitMinutes * 60 * 1000
    );

    const proc = Bun.spawn(agent.command.split(" "), {
      stdin: new Blob([input]),
      stdout: "pipe",
      stderr: "pipe",
    });

    // Timeout enforcement
    const timeoutId = setTimeout(() => {
      proc.kill();
    }, timeout);

    const stdout = await new Response(proc.stdout).text();
    clearTimeout(timeoutId);

    const exitCode = await proc.exited;
    const timeSeconds = (Date.now() - startTime) / 1000;

    if (exitCode !== 0) {
      return {
        challengeId: challenge.id,
        agentModel: agent.model,
        score: 0,
        passed: false,
        timeSeconds,
        attempt,
        details: { error: `Agent exited with code ${exitCode}` },
      };
    }

    // Parse agent output
    let agentOutput: unknown;
    try {
      agentOutput = JSON.parse(stdout);
    } catch {
      return {
        challengeId: challenge.id,
        agentModel: agent.model,
        score: 0,
        passed: false,
        timeSeconds,
        attempt,
        details: { error: "Agent output is not valid JSON" },
      };
    }

    // Score the result
    const scored = scoreChallenge(challenge, agentOutput, groundTruth);
    return {
      ...scored,
      agentModel: agent.model,
      timeSeconds,
      attempt,
    };
  } catch (err) {
    const timeSeconds = (Date.now() - startTime) / 1000;
    return {
      challengeId: challenge.id,
      agentModel: agent.model,
      score: 0,
      passed: false,
      timeSeconds,
      attempt,
      details: {
        error: err instanceof Error ? err.message : "Unknown execution error",
      },
    };
  }
}

/**
 * Calculate macro-average scores per category.
 */
function calculateCategoryScores(
  results: ChallengeResult[]
): Record<string, number> {
  const byCategory = new Map<string, number[]>();

  for (const result of results) {
    // Extract category from challengeId prefix (e.g., "ep-001" -> "evidence-parsing")
    const category = inferCategory(result.challengeId);
    if (!byCategory.has(category)) {
      byCategory.set(category, []);
    }
    byCategory.get(category)!.push(result.score);
  }

  const scores: Record<string, number> = {};
  for (const [category, values] of byCategory) {
    scores[category] =
      Math.round(
        (values.reduce((sum, v) => sum + v, 0) / values.length) * 100
      ) / 100;
  }

  return scores;
}

/** Map challenge ID prefix to category name */
function inferCategory(challengeId: string): string {
  const prefix = challengeId.split("-")[0];
  const map: Record<string, string> = {
    ep: "evidence-parsing",
    cm: "control-mapping",
    cg: "cpoe-generation",
    dd: "drift-detection",
    ga: "gap-analysis",
    pr: "policy-review",
    ra: "risk-analysis",
  };
  return map[prefix] ?? "unknown";
}
