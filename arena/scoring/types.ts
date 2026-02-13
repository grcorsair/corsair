/**
 * GRC Model Arena — Type Definitions
 *
 * Defines the type system for the Corsair GRC Model Arena benchmark.
 * Challenge categories map to core GRC AI capabilities:
 * evidence parsing, control mapping, CPOE generation, drift detection,
 * gap analysis, policy review, and risk analysis.
 */

// =============================================================================
// CHALLENGE CATEGORIES
// =============================================================================

/** GRC AI capability categories benchmarked by the Arena */
export type ChallengeCategory =
  | "evidence-parsing"
  | "control-mapping"
  | "cpoe-generation"
  | "drift-detection"
  | "gap-analysis"
  | "policy-review"
  | "risk-analysis";

// =============================================================================
// CHALLENGE DEFINITION
// =============================================================================

/** A single benchmark challenge */
export interface Challenge {
  /** Unique challenge identifier (e.g., "ep-001") */
  id: string;

  /** Which GRC capability this tests */
  category: ChallengeCategory;

  /** Difficulty tier */
  difficulty: "easy" | "medium" | "hard";

  /** Human-readable description of what the challenge tests */
  description: string;

  /** Path to input file (relative to arena/challenges/) */
  input: string;

  /** Path to expected output / ground truth (relative to arena/challenges/) */
  groundTruth: string;

  /** How to score the agent's output */
  scoring: ScoringConfig;

  /** Searchable tags (e.g., ["prowler", "aws", "soc2"]) */
  tags: string[];

  /** Maximum time allowed in minutes */
  timeLimitMinutes: number;

  /** Optional list of allowed tools */
  tools?: string[];
}

// =============================================================================
// SCORING
// =============================================================================

/** Scoring method configuration */
export interface ScoringConfig {
  /** Scoring algorithm to apply */
  method: "json-field-match" | "precision-recall" | "cpoe-verify" | "diff-match";

  /** Dot-notation field paths for json-field-match (e.g., ["summary.controlsPassed"]) */
  fields?: string[];

  /** F1 threshold for precision-recall (default 0.8) */
  threshold?: number;

  /** Whether to award points for partially correct answers */
  partialCredit: boolean;

  /** Maximum achievable score for this challenge */
  maxScore: number;
}

// =============================================================================
// RESULTS
// =============================================================================

/** Result of a single challenge attempt */
export interface ChallengeResult {
  /** Which challenge was attempted */
  challengeId: string;

  /** Model identifier (e.g., "claude-opus-4-6", "gpt-4o") */
  agentModel: string;

  /** Score achieved (0-100) */
  score: number;

  /** Whether the challenge was passed (score >= 70) */
  passed: boolean;

  /** Wall-clock time in seconds */
  timeSeconds: number;

  /** Attempt number (1-based, for pass@3) */
  attempt: number;

  /** Scoring breakdown and diagnostics */
  details: Record<string, unknown>;
}

/** A complete benchmark run across all challenges */
export interface BenchmarkRun {
  /** Unique run identifier */
  runId: string;

  /** ISO 8601 date of the run */
  date: string;

  /** Model identifier */
  agentModel: string;

  /** Per-challenge results */
  results: ChallengeResult[];

  /** Macro-average score across categories */
  overallScore: number;

  /** Average score per category */
  categoryScores: Record<string, number>;
}

// =============================================================================
// AGENT CONFIGURATION
// =============================================================================

/** Configuration for an agent to benchmark */
export interface AgentConfig {
  /** Human-readable agent name */
  name: string;

  /** Model identifier */
  model: string;

  /** Shell command to invoke the agent */
  command: string;

  /** Per-challenge timeout in milliseconds */
  timeout: number;
}

// =============================================================================
// LEADERBOARD
// =============================================================================

/** A single row in the leaderboard */
export interface LeaderboardEntry {
  /** Position (1-based) */
  rank: number;

  /** Model identifier */
  agentModel: string;

  /** Macro-average score */
  overallScore: number;

  /** Per-category scores */
  categoryScores: Record<string, number>;

  /** Number of challenges passed (score >= 70) */
  challengesPassed: number;

  /** Total challenges attempted */
  challengesTotal: number;

  /** ISO 8601 date of last run */
  lastRunDate: string;
}
