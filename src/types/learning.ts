/**
 * Learning System Type Definitions (Phase 2.2)
 *
 * Types for the pattern learning system that extracts insights
 * from historical mission ISC data.
 */

/**
 * Common ISC pattern found across multiple missions.
 */
export interface CommonPattern {
  /** The criterion text (normalized) */
  text: string;

  /** How often this criterion appears (0-1) */
  frequency: number;

  /** Confidence in this pattern (based on sample size) */
  confidence: number;

  /** Number of missions this pattern was found in */
  sampleSize: number;

  /** Services where this pattern was observed */
  services: string[];
}

/**
 * Pattern of frequently failing criteria.
 */
export interface FailurePattern {
  /** The criterion text (normalized) */
  text: string;

  /** Failure rate (0-1) - how often this criterion fails */
  failureRate: number;

  /** Confidence in this pattern */
  confidence: number;

  /** Number of times this criterion was evaluated */
  sampleSize: number;

  /** Services where failures were observed */
  services: string[];

  /** Common reasons for failure (if available) */
  commonReasons?: string[];
}

/**
 * Pattern of frequently succeeding criteria.
 */
export interface SuccessPattern {
  /** The criterion text (normalized) */
  text: string;

  /** Success rate (0-1) - how often this criterion passes */
  successRate: number;

  /** Confidence in this pattern */
  confidence: number;

  /** Number of times this criterion was evaluated */
  sampleSize: number;

  /** Services where successes were observed */
  services: string[];
}

/**
 * Complete set of extracted ISC patterns.
 */
export interface ISCPatterns {
  /** Criteria that appear frequently across missions (>50% frequency) */
  common: CommonPattern[];

  /** Criteria that frequently fail (>30% failure rate) */
  failures: FailurePattern[];

  /** Criteria that frequently succeed (>80% success rate) */
  successes: SuccessPattern[];

  /** When patterns were extracted */
  extractedAt: string;

  /** Number of missions analyzed */
  missionCount: number;
}

/**
 * Internal structure for tracking criterion statistics during analysis.
 */
export interface CriterionStats {
  /** Normalized text of the criterion */
  text: string;

  /** Number of times this criterion appeared */
  count: number;

  /** Number of times it was satisfied */
  satisfiedCount: number;

  /** Number of times it failed */
  failedCount: number;

  /** Services where this criterion was used */
  services: Set<string>;
}

/**
 * Options for pattern extraction.
 */
export interface PatternExtractionOptions {
  /** Filter by service type */
  service?: string;

  /** Minimum sample size for pattern inclusion */
  minSampleSize?: number;

  /** Date range start (YYYY-MM-DD) */
  startDate?: string;

  /** Date range end (YYYY-MM-DD) */
  endDate?: string;
}
