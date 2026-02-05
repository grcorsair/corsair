/**
 * ISCManager - Ideal State Criteria Manager
 *
 * Tracks security expectations (ISC) and their satisfaction status
 * throughout Corsair missions. Enables measuring progress toward security goals.
 *
 * Key Features:
 * - Add and track individual criteria with unique IDs
 * - Update satisfaction status (PENDING, SATISFIED, FAILED)
 * - Link evidence to criteria for audit trail
 * - Calculate satisfaction rate
 * - Persist/load state to/from JSON files
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type {
  ISCCriterion,
  ISCSatisfaction,
  ISCState,
  ISCStatus,
  ISCSatisfactionStatus,
  ISCVerificationResult,
} from "../types/isc";

export class ISCManager {
  private missionId: string;
  private status: ISCStatus;
  private criteria: Map<string, ISCCriterion>;
  private criteriaByText: Map<string, string>; // text -> id (for duplicate detection)
  private createdAt: string;
  private updatedAt: string;
  private metadata: Record<string, unknown>;

  constructor(missionId: string) {
    this.missionId = missionId;
    this.status = "PENDING";
    this.criteria = new Map();
    this.criteriaByText = new Map();
    this.createdAt = new Date().toISOString();
    this.updatedAt = this.createdAt;
    this.metadata = {};
  }

  /**
   * Generate a unique, filename-safe mission ID.
   * Format: {prefix}_{YYYYMMDD}_{HHMMSS}_{random}
   */
  static generateMissionId(prefix: string = "mission"): string {
    const now = new Date();
    const datePart = now.toISOString().split("T")[0].replace(/-/g, "");
    const timePart = now.toISOString().split("T")[1].split(".")[0].replace(/:/g, "");
    const randomPart = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${datePart}_${timePart}_${randomPart}`;
  }

  /**
   * Generate a unique criterion ID.
   * Format: ISC-{timestamp}-{random}
   */
  private generateCriterionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `ISC-${timestamp}-${random}`;
  }

  /**
   * Get the mission ID.
   */
  getMissionId(): string {
    return this.missionId;
  }

  /**
   * Get the overall status.
   */
  getStatus(): ISCStatus {
    return this.status;
  }

  /**
   * Update the overall status.
   */
  updateStatus(status: ISCStatus): void {
    this.status = status;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Update metadata.
   */
  updateMetadata(metadata: Record<string, unknown>): void {
    this.metadata = { ...this.metadata, ...metadata };
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Get all criteria as an array.
   */
  getCriteria(): ISCCriterion[] {
    return Array.from(this.criteria.values());
  }

  /**
   * Get a specific criterion by ID.
   */
  getCriterion(id: string): ISCCriterion | undefined {
    return this.criteria.get(id);
  }

  /**
   * Add a single criterion. Returns the criterion ID.
   * If a criterion with the same text already exists, returns its ID (no duplicate).
   */
  addCriterion(text: string, options?: { confidence?: number; source?: string }): string {
    // Normalize text for duplicate detection
    const normalizedText = text.trim().toLowerCase();

    // Check for duplicate
    const existingId = this.criteriaByText.get(normalizedText);
    if (existingId) {
      return existingId;
    }

    const id = this.generateCriterionId();
    const criterion: ISCCriterion = {
      id,
      text: text.trim(),
      satisfaction: "PENDING",
      evidenceRefs: [],
      createdAt: new Date().toISOString(),
      confidence: options?.confidence,
      source: options?.source,
    };

    this.criteria.set(id, criterion);
    this.criteriaByText.set(normalizedText, id);
    this.updatedAt = new Date().toISOString();

    return id;
  }

  /**
   * Add multiple criteria at once. Returns array of criterion IDs.
   */
  addCriteria(texts: string[], options?: { confidence?: number; source?: string }): string[] {
    return texts.map((text) => this.addCriterion(text, options));
  }

  /**
   * Update the satisfaction status of a criterion.
   */
  updateSatisfaction(id: string, satisfaction: ISCSatisfactionStatus): void {
    const criterion = this.criteria.get(id);
    if (!criterion) {
      // Gracefully handle nonexistent criterion
      return;
    }

    criterion.satisfaction = satisfaction;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Verify a criterion with evidence.
   * Returns the verification result.
   */
  verifyCriterion(
    id: string,
    passed: boolean,
    evidenceRef?: string
  ): ISCVerificationResult {
    const criterion = this.criteria.get(id);
    const verifiedAt = new Date().toISOString();

    if (!criterion) {
      // Return result indicating verification didn't happen
      return {
        criterionId: id,
        verified: false,
        satisfaction: "PENDING",
        evidenceRef,
        verifiedAt,
      };
    }

    const satisfaction: ISCSatisfactionStatus = passed ? "SATISFIED" : "FAILED";
    criterion.satisfaction = satisfaction;
    criterion.verifiedAt = verifiedAt;

    if (evidenceRef && !criterion.evidenceRefs.includes(evidenceRef)) {
      criterion.evidenceRefs.push(evidenceRef);
    }

    this.updatedAt = verifiedAt;

    return {
      criterionId: id,
      verified: true,
      satisfaction,
      evidenceRef,
      verifiedAt,
    };
  }

  /**
   * Calculate the satisfaction rate as a percentage (0-100).
   * Only counts SATISFIED criteria against total.
   */
  getSatisfactionRate(): number {
    const total = this.criteria.size;
    if (total === 0) return 0;

    let satisfied = 0;
    for (const criterion of this.criteria.values()) {
      if (criterion.satisfaction === "SATISFIED") {
        satisfied++;
      }
    }

    return Math.round((satisfied / total) * 100);
  }

  /**
   * Get aggregate satisfaction statistics.
   */
  getSatisfactionStats(): ISCSatisfaction {
    let satisfied = 0;
    let failed = 0;
    let pending = 0;

    for (const criterion of this.criteria.values()) {
      switch (criterion.satisfaction) {
        case "SATISFIED":
          satisfied++;
          break;
        case "FAILED":
          failed++;
          break;
        case "PENDING":
          pending++;
          break;
      }
    }

    const total = this.criteria.size;
    const rate = total > 0 ? Math.round((satisfied / total) * 100) : 0;

    return { satisfied, failed, pending, total, rate };
  }

  /**
   * Get the complete ISC state for inspection.
   */
  getState(): ISCState {
    return {
      missionId: this.missionId,
      status: this.status,
      criteria: this.getCriteria(),
      satisfaction: this.getSatisfactionStats(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      metadata: Object.keys(this.metadata).length > 0 ? this.metadata : undefined,
    };
  }

  /**
   * Persist ISC state to a JSON file.
   * Creates parent directories if they don't exist.
   */
  async persist(filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const state = this.getState();
    const content = JSON.stringify(state, null, 2);
    fs.writeFileSync(filePath, content, "utf-8");
  }

  /**
   * Load ISC state from a JSON file.
   * Returns a new ISCManager instance with the loaded state.
   */
  static async load(filePath: string): Promise<ISCManager> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`ISC file not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const state: ISCState = JSON.parse(content);

    const manager = new ISCManager(state.missionId);
    manager.status = state.status;
    manager.createdAt = state.createdAt;
    manager.updatedAt = state.updatedAt;
    manager.metadata = state.metadata || {};

    // Restore criteria
    for (const criterion of state.criteria) {
      manager.criteria.set(criterion.id, criterion);
      manager.criteriaByText.set(criterion.text.trim().toLowerCase(), criterion.id);
    }

    return manager;
  }
}
