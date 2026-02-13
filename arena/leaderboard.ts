/**
 * GRC Model Arena — Leaderboard
 *
 * Aggregates benchmark runs into ranked leaderboard entries.
 * Formats output as Markdown table for README display.
 */

import type { BenchmarkRun, LeaderboardEntry } from "./scoring/types";

/**
 * Generate a ranked leaderboard from benchmark runs.
 * Ranks by overallScore descending. One entry per unique agentModel
 * (uses the latest run if multiple exist for the same model).
 */
export function generateLeaderboard(runs: BenchmarkRun[]): LeaderboardEntry[] {
  if (runs.length === 0) return [];

  // Group by agent model, keep latest run per model
  const latestByModel = new Map<string, BenchmarkRun>();
  for (const run of runs) {
    const existing = latestByModel.get(run.agentModel);
    if (!existing || run.date > existing.date) {
      latestByModel.set(run.agentModel, run);
    }
  }

  // Convert to entries
  const entries: LeaderboardEntry[] = [];
  for (const [model, run] of latestByModel) {
    const challengesPassed = run.results.filter((r) => r.passed).length;
    const challengesTotal = run.results.length;

    entries.push({
      rank: 0, // Set after sorting
      agentModel: model,
      overallScore: run.overallScore,
      categoryScores: { ...run.categoryScores },
      challengesPassed,
      challengesTotal,
      lastRunDate: run.date,
    });
  }

  // Sort by overallScore descending
  entries.sort((a, b) => b.overallScore - a.overallScore);

  // Assign ranks
  for (let i = 0; i < entries.length; i++) {
    entries[i].rank = i + 1;
  }

  return entries;
}

/**
 * Format leaderboard entries as a Markdown table.
 * Returns empty string for empty leaderboard.
 */
export function formatLeaderboardMarkdown(entries: LeaderboardEntry[]): string {
  if (entries.length === 0) return "";

  const lines: string[] = [];

  lines.push("| Rank | Model | Overall | Passed | Last Run |");
  lines.push("|-----:|:------|--------:|:------:|:---------|");

  for (const entry of entries) {
    const passed = `${entry.challengesPassed}/${entry.challengesTotal}`;
    const date = entry.lastRunDate.split("T")[0];
    lines.push(
      `| ${entry.rank} | ${entry.agentModel} | ${entry.overallScore.toFixed(1)} | ${passed} | ${date} |`
    );
  }

  return lines.join("\n");
}
