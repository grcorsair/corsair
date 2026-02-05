/**
 * ISCIndex - ISC Search Index (Phase 2.4)
 *
 * Provides fast text search across historical ISC criteria
 * using a word-based inverted index.
 *
 * Features:
 * - Build word-based text index for criteria
 * - Search criteria by text query
 * - Filter by service, status, date range
 * - Calculate satisfaction rates across missions
 * - Persist index to LEARNING directory
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { WorkManager } from "./work-manager";
import type { ISCSatisfactionStatus } from "../types/isc";

/**
 * Indexed criterion entry.
 */
export interface IndexedCriterion {
  /** Criterion ID */
  id: string;

  /** Criterion text */
  text: string;

  /** Satisfaction status */
  satisfaction: ISCSatisfactionStatus;

  /** Mission ID this criterion belongs to */
  missionId: string;

  /** Service type of the mission */
  service: string;

  /** Mission date (YYYY-MM-DD) */
  date: string;
}

/**
 * Search filter options.
 */
export interface SearchFilter {
  /** Filter by service type */
  service?: string;

  /** Filter by satisfaction status */
  status?: ISCSatisfactionStatus;

  /** Filter by start date (YYYY-MM-DD, inclusive) */
  startDate?: string;

  /** Filter by end date (YYYY-MM-DD, inclusive) */
  endDate?: string;
}

/**
 * Index statistics.
 */
export interface IndexStats {
  /** Total number of indexed criteria */
  totalCriteria: number;

  /** Total number of missions indexed */
  totalMissions: number;

  /** Number of unique words in index */
  wordCount: number;

  /** When index was last built */
  builtAt?: string;
}

/**
 * Serializable index state for persistence.
 */
interface SerializedIndex {
  criteria: IndexedCriterion[];
  wordIndex: Record<string, string[]>; // word -> criterion IDs
  stats: IndexStats;
}

export class ISCIndex {
  private workManager: WorkManager;

  /** All indexed criteria */
  private criteria: Map<string, IndexedCriterion> = new Map();

  /** Word to criterion IDs mapping */
  private wordIndex: Map<string, Set<string>> = new Map();

  /** Index statistics */
  private stats: IndexStats = {
    totalCriteria: 0,
    totalMissions: 0,
    wordCount: 0,
  };

  /** Set of indexed mission IDs */
  private indexedMissions: Set<string> = new Set();

  constructor(workManager: WorkManager) {
    this.workManager = workManager;
  }

  /**
   * Tokenize text into searchable words.
   *
   * @param text - Text to tokenize
   * @returns Array of lowercase words
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 2);
  }

  /**
   * Add a criterion to the index.
   *
   * @param criterion - Criterion to index
   */
  private addToIndex(criterion: IndexedCriterion): void {
    this.criteria.set(criterion.id, criterion);

    // Tokenize and add to word index
    const words = this.tokenize(criterion.text);
    for (const word of words) {
      if (!this.wordIndex.has(word)) {
        this.wordIndex.set(word, new Set());
      }
      this.wordIndex.get(word)!.add(criterion.id);
    }
  }

  /**
   * Build the index from all ISC data in the work directory.
   */
  async build(): Promise<void> {
    // Clear existing index
    this.criteria.clear();
    this.wordIndex.clear();
    this.indexedMissions.clear();

    const dates = await this.workManager.getActiveDates();

    for (const date of dates) {
      const missions = await this.workManager.listMissionsByDate(date);

      for (const mission of missions) {
        const isc = await this.workManager.loadISC(mission.missionId);
        if (!isc || isc.criteria.length === 0) continue;

        this.indexedMissions.add(mission.missionId);

        for (const criterion of isc.criteria) {
          const indexed: IndexedCriterion = {
            id: criterion.id,
            text: criterion.text,
            satisfaction: criterion.satisfaction,
            missionId: mission.missionId,
            service: mission.service,
            date,
          };

          this.addToIndex(indexed);
        }
      }
    }

    // Update stats
    this.stats = {
      totalCriteria: this.criteria.size,
      totalMissions: this.indexedMissions.size,
      wordCount: this.wordIndex.size,
      builtAt: new Date().toISOString(),
    };
  }

  /**
   * Search criteria by text query.
   *
   * @param query - Search query (space-separated words)
   * @param filter - Optional search filters
   * @returns Matching criteria
   */
  async search(query: string, filter?: SearchFilter): Promise<IndexedCriterion[]> {
    const queryWords = this.tokenize(query);
    if (queryWords.length === 0) {
      return [];
    }

    // Find criteria matching all query words
    let matchingIds: Set<string> | null = null;

    for (const word of queryWords) {
      const wordMatches = this.wordIndex.get(word);
      if (!wordMatches) {
        // No matches for this word
        return [];
      }

      if (matchingIds === null) {
        matchingIds = new Set(wordMatches);
      } else {
        // Intersect with previous matches
        matchingIds = new Set([...matchingIds].filter((id) => wordMatches.has(id)));
      }

      if (matchingIds.size === 0) {
        return [];
      }
    }

    if (!matchingIds) {
      return [];
    }

    // Get criteria and apply filters
    let results: IndexedCriterion[] = [];
    for (const id of matchingIds) {
      const criterion = this.criteria.get(id);
      if (criterion) {
        results.push(criterion);
      }
    }

    // Apply filters
    if (filter) {
      results = results.filter((c) => {
        if (filter.service && c.service !== filter.service) return false;
        if (filter.status && c.satisfaction !== filter.status) return false;
        if (filter.startDate && c.date < filter.startDate) return false;
        if (filter.endDate && c.date > filter.endDate) return false;
        return true;
      });
    }

    return results;
  }

  /**
   * Get index statistics.
   */
  getStats(): IndexStats {
    return { ...this.stats };
  }

  /**
   * Calculate overall satisfaction rate across all indexed criteria.
   *
   * @returns Satisfaction rate as percentage (0-100)
   */
  getOverallSatisfactionRate(): number {
    if (this.criteria.size === 0) return 0;

    let satisfied = 0;
    let evaluated = 0;

    for (const criterion of this.criteria.values()) {
      if (criterion.satisfaction !== "PENDING") {
        evaluated++;
        if (criterion.satisfaction === "SATISFIED") {
          satisfied++;
        }
      }
    }

    if (evaluated === 0) return 0;
    return Math.round((satisfied / evaluated) * 100);
  }

  /**
   * Calculate satisfaction rate for a specific service.
   *
   * @param service - Service type to calculate rate for
   * @returns Satisfaction rate as percentage (0-100)
   */
  getSatisfactionRateByService(service: string): number {
    let satisfied = 0;
    let evaluated = 0;

    for (const criterion of this.criteria.values()) {
      if (criterion.service !== service) continue;
      if (criterion.satisfaction !== "PENDING") {
        evaluated++;
        if (criterion.satisfaction === "SATISFIED") {
          satisfied++;
        }
      }
    }

    if (evaluated === 0) return 0;
    return Math.round((satisfied / evaluated) * 100);
  }

  /**
   * Persist the index to the LEARNING directory.
   */
  async persist(): Promise<void> {
    const learningPath = this.workManager.getLearningPath();
    const indexPath = path.join(learningPath, "isc-index.json");

    // Convert to serializable format
    const serialized: SerializedIndex = {
      criteria: Array.from(this.criteria.values()),
      wordIndex: Object.fromEntries(
        Array.from(this.wordIndex.entries()).map(([word, ids]) => [word, Array.from(ids)])
      ),
      stats: this.stats,
    };

    fs.writeFileSync(indexPath, JSON.stringify(serialized, null, 2), "utf-8");
  }

  /**
   * Load the index from the LEARNING directory.
   *
   * @returns Whether the index was successfully loaded
   */
  async load(): Promise<boolean> {
    const learningPath = this.workManager.getLearningPath();
    const indexPath = path.join(learningPath, "isc-index.json");

    if (!fs.existsSync(indexPath)) {
      return false;
    }

    try {
      const content = fs.readFileSync(indexPath, "utf-8");
      const serialized: SerializedIndex = JSON.parse(content);

      // Restore criteria
      this.criteria.clear();
      for (const criterion of serialized.criteria) {
        this.criteria.set(criterion.id, criterion);
      }

      // Restore word index
      this.wordIndex.clear();
      for (const [word, ids] of Object.entries(serialized.wordIndex)) {
        this.wordIndex.set(word, new Set(ids));
      }

      // Restore stats
      this.stats = serialized.stats;

      // Rebuild indexed missions set
      this.indexedMissions.clear();
      for (const criterion of this.criteria.values()) {
        this.indexedMissions.add(criterion.missionId);
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all criteria (unfiltered).
   */
  getAllCriteria(): IndexedCriterion[] {
    return Array.from(this.criteria.values());
  }

  /**
   * Get criteria by mission ID.
   *
   * @param missionId - Mission ID to filter by
   * @returns Criteria for that mission
   */
  getCriteriaByMission(missionId: string): IndexedCriterion[] {
    return Array.from(this.criteria.values()).filter((c) => c.missionId === missionId);
  }
}
