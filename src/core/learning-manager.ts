/**
 * LearningManager - Pattern Learning System (Phase 2.2)
 *
 * Extracts patterns from historical mission ISC data to enable
 * continuous improvement of security testing.
 *
 * Features:
 * - Extract common ISC patterns (>50% frequency)
 * - Identify failure patterns (>30% failure rate)
 * - Identify success patterns (>80% success rate)
 * - Confidence scoring based on sample size
 * - Service-specific pattern tracking
 * - Pattern persistence to LEARNING directory
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { WorkManager } from "./work-manager";
import type { ISCState } from "../types/isc";
import type {
  ISCPatterns,
  CommonPattern,
  FailurePattern,
  SuccessPattern,
  CriterionStats,
  PatternExtractionOptions,
} from "../types/learning";

// Pattern thresholds
const COMMON_FREQUENCY_THRESHOLD = 0.5; // 50%
const FAILURE_RATE_THRESHOLD = 0.3; // 30%
const SUCCESS_RATE_THRESHOLD = 0.8; // 80%

export class LearningManager {
  private workManager: WorkManager;
  private patterns: ISCPatterns | null = null;

  constructor(workManager: WorkManager) {
    this.workManager = workManager;
  }

  /**
   * Calculate confidence score based on sample size.
   *
   * Formula: min(0.95, log10(sampleSize + 1) / 1.5)
   *
   * This gives:
   * - 2 samples: ~0.32
   * - 5 samples: ~0.52
   * - 10 samples: ~0.69
   * - 100 samples: ~0.95 (capped)
   *
   * @param sampleSize - Number of samples
   * @returns Confidence score (0-0.95)
   */
  private calculateConfidence(sampleSize: number): number {
    return Math.min(0.95, Math.log10(sampleSize + 1) / 1.5);
  }

  /**
   * Normalize criterion text for comparison.
   *
   * @param text - Original criterion text
   * @returns Normalized text (lowercase, trimmed)
   */
  private normalizeText(text: string): string {
    return text.toLowerCase().trim();
  }

  /**
   * Extract all ISC states from the work directory.
   *
   * @param options - Extraction options (service filter, date range)
   * @returns Array of ISC states with associated metadata
   */
  private async collectISCStates(
    options: PatternExtractionOptions = {}
  ): Promise<Array<{ isc: ISCState; service: string }>> {
    const results: Array<{ isc: ISCState; service: string }> = [];
    const dates = await this.workManager.getActiveDates();

    for (const date of dates) {
      // Apply date range filter
      if (options.startDate && date < options.startDate) continue;
      if (options.endDate && date > options.endDate) continue;

      const missions = await this.workManager.listMissionsByDate(date);

      for (const mission of missions) {
        // Apply service filter
        if (options.service && mission.service !== options.service) continue;

        const isc = await this.workManager.loadISC(mission.missionId);
        if (isc && isc.criteria.length > 0) {
          results.push({ isc, service: mission.service });
        }
      }
    }

    return results;
  }

  /**
   * Build statistics for all criteria across collected ISC states.
   *
   * @param iscData - Collected ISC states with metadata
   * @returns Map of normalized text to statistics
   */
  private buildCriterionStats(
    iscData: Array<{ isc: ISCState; service: string }>
  ): Map<string, CriterionStats> {
    const stats = new Map<string, CriterionStats>();

    for (const { isc, service } of iscData) {
      for (const criterion of isc.criteria) {
        const normalizedText = this.normalizeText(criterion.text);

        let stat = stats.get(normalizedText);
        if (!stat) {
          stat = {
            text: criterion.text, // Keep original case for first occurrence
            count: 0,
            satisfiedCount: 0,
            failedCount: 0,
            services: new Set(),
          };
          stats.set(normalizedText, stat);
        }

        stat.count++;
        stat.services.add(service);

        if (criterion.satisfaction === "SATISFIED") {
          stat.satisfiedCount++;
        } else if (criterion.satisfaction === "FAILED") {
          stat.failedCount++;
        }
      }
    }

    return stats;
  }

  /**
   * Extract common patterns (criteria that appear in >50% of missions).
   *
   * @param stats - Criterion statistics
   * @param missionCount - Total number of missions
   * @returns Array of common patterns
   */
  private extractCommonPatterns(
    stats: Map<string, CriterionStats>,
    missionCount: number
  ): CommonPattern[] {
    const patterns: CommonPattern[] = [];

    if (missionCount === 0) return patterns;

    for (const stat of stats.values()) {
      const frequency = stat.count / missionCount;

      if (frequency >= COMMON_FREQUENCY_THRESHOLD) {
        patterns.push({
          text: stat.text,
          frequency,
          confidence: this.calculateConfidence(stat.count),
          sampleSize: stat.count,
          services: Array.from(stat.services),
        });
      }
    }

    // Sort by frequency descending
    return patterns.sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Extract failure patterns (criteria with >30% failure rate).
   *
   * @param stats - Criterion statistics
   * @returns Array of failure patterns
   */
  private extractFailurePatterns(stats: Map<string, CriterionStats>): FailurePattern[] {
    const patterns: FailurePattern[] = [];

    for (const stat of stats.values()) {
      const evaluatedCount = stat.satisfiedCount + stat.failedCount;
      if (evaluatedCount === 0) continue;

      const failureRate = stat.failedCount / evaluatedCount;

      if (failureRate >= FAILURE_RATE_THRESHOLD) {
        patterns.push({
          text: stat.text,
          failureRate,
          confidence: this.calculateConfidence(evaluatedCount),
          sampleSize: evaluatedCount,
          services: Array.from(stat.services),
        });
      }
    }

    // Sort by failure rate descending
    return patterns.sort((a, b) => b.failureRate - a.failureRate);
  }

  /**
   * Extract success patterns (criteria with >80% success rate).
   *
   * @param stats - Criterion statistics
   * @returns Array of success patterns
   */
  private extractSuccessPatterns(stats: Map<string, CriterionStats>): SuccessPattern[] {
    const patterns: SuccessPattern[] = [];

    for (const stat of stats.values()) {
      const evaluatedCount = stat.satisfiedCount + stat.failedCount;
      if (evaluatedCount === 0) continue;

      const successRate = stat.satisfiedCount / evaluatedCount;

      if (successRate >= SUCCESS_RATE_THRESHOLD) {
        patterns.push({
          text: stat.text,
          successRate,
          confidence: this.calculateConfidence(evaluatedCount),
          sampleSize: evaluatedCount,
          services: Array.from(stat.services),
        });
      }
    }

    // Sort by success rate descending
    return patterns.sort((a, b) => b.successRate - a.successRate);
  }

  /**
   * Extract all patterns from historical mission data.
   *
   * @param options - Extraction options
   * @returns Complete set of patterns
   */
  async extractPatterns(options: PatternExtractionOptions = {}): Promise<ISCPatterns> {
    // Collect all ISC data
    const iscData = await this.collectISCStates(options);
    const missionCount = iscData.length;

    // Build statistics
    const stats = this.buildCriterionStats(iscData);

    // Extract patterns
    const common = this.extractCommonPatterns(stats, missionCount);
    const failures = this.extractFailurePatterns(stats);
    const successes = this.extractSuccessPatterns(stats);

    this.patterns = {
      common,
      failures,
      successes,
      extractedAt: new Date().toISOString(),
      missionCount,
    };

    return this.patterns;
  }

  /**
   * Get current patterns (from cache or null if not extracted).
   */
  getPatterns(): ISCPatterns | null {
    return this.patterns;
  }

  /**
   * Persist patterns to the LEARNING directory.
   */
  async persistPatterns(): Promise<void> {
    if (!this.patterns) {
      throw new Error("No patterns to persist. Call extractPatterns() first.");
    }

    const learningPath = this.workManager.getLearningPath();
    const patternsPath = path.join(learningPath, "patterns.json");

    fs.writeFileSync(patternsPath, JSON.stringify(this.patterns, null, 2), "utf-8");
  }

  /**
   * Load patterns from the LEARNING directory.
   *
   * @returns Loaded patterns or null if not found
   */
  async loadPatterns(): Promise<ISCPatterns | null> {
    const learningPath = this.workManager.getLearningPath();
    const patternsPath = path.join(learningPath, "patterns.json");

    if (!fs.existsSync(patternsPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(patternsPath, "utf-8");
      this.patterns = JSON.parse(content);
      return this.patterns;
    } catch {
      return null;
    }
  }

  /**
   * Get suggested criteria based on service type.
   *
   * Returns high-success patterns and warns about high-failure patterns.
   *
   * @param service - Service type to get suggestions for
   * @returns Suggested criteria and warnings
   */
  async getSuggestions(
    service: string
  ): Promise<{ suggested: string[]; warnings: string[] }> {
    let patterns = this.patterns;
    if (!patterns) {
      patterns = await this.loadPatterns();
    }

    if (!patterns) {
      return { suggested: [], warnings: [] };
    }

    // Suggested: high-success patterns for this service
    const suggested = patterns.successes
      .filter((p) => p.services.includes(service))
      .map((p) => p.text);

    // Warnings: high-failure patterns for this service
    const warnings = patterns.failures
      .filter((p) => p.services.includes(service))
      .map((p) => `"${p.text}" frequently fails (${Math.round(p.failureRate * 100)}%)`);

    return { suggested, warnings };
  }
}
