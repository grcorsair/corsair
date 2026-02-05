/**
 * WorkManager - Mission Work Directory Manager (Phase 2.1)
 *
 * Manages the work directory structure for Corsair missions:
 * - Organizes missions by date in WORK/{YYYY-MM-DD}/{missionId}/
 * - Provides mission lifecycle management (create, update, complete)
 * - Handles ISC persistence within mission directories
 * - Supports concurrent operations with proper file handling
 *
 * Directory Structure:
 * corsair-work/
 *   WORK/
 *     2025-02-05/
 *       mission_20250205_143000_abc123/
 *         mission-metadata.json
 *         mission.log
 *         ISC.json
 *         recon-results.json
 *   LEARNING/
 *     patterns.json
 *     isc-index.json
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type {
  MissionMetadata,
  MissionLog,
  MissionStatus,
  MissionSummary,
  WorkDirectory,
} from "../types/work";
import type { ISCState } from "../types/isc";

export class WorkManager {
  private basePath: string;
  private workPath: string;
  private learningPath: string;
  private initialized: boolean = false;

  /**
   * Create a new WorkManager instance.
   *
   * @param basePath - Base directory for work data (default: ./corsair-work)
   */
  constructor(basePath: string = "./corsair-work") {
    this.basePath = basePath;
    this.workPath = path.join(basePath, "WORK");
    this.learningPath = path.join(basePath, "LEARNING");
  }

  /**
   * Initialize the work directory structure.
   * Creates WORK and LEARNING directories if they don't exist.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Create base directories
    if (!fs.existsSync(this.workPath)) {
      fs.mkdirSync(this.workPath, { recursive: true });
    }

    if (!fs.existsSync(this.learningPath)) {
      fs.mkdirSync(this.learningPath, { recursive: true });
    }

    this.initialized = true;
  }

  /**
   * Get the work directory information.
   */
  getDirectoryInfo(): WorkDirectory {
    return {
      basePath: this.basePath,
      workPath: this.workPath,
      learningPath: this.learningPath,
      initialized: this.initialized,
    };
  }

  /**
   * Extract the date (YYYY-MM-DD) from a mission ID.
   *
   * Mission ID format: mission_YYYYMMDD_HHMMSS_random
   * Example: mission_20250205_143000_abc123 -> 2025-02-05
   *
   * @param missionId - The mission ID to parse
   * @returns Date string in YYYY-MM-DD format
   */
  extractDateFromMissionId(missionId: string): string {
    // Match pattern: prefix_YYYYMMDD_...
    const match = missionId.match(/_(\d{4})(\d{2})(\d{2})_/);
    if (match) {
      const [, year, month, day] = match;
      return `${year}-${month}-${day}`;
    }

    // Fallback to current date
    return new Date().toISOString().split("T")[0];
  }

  /**
   * Create a mission directory.
   *
   * Creates: WORK/{YYYY-MM-DD}/{missionId}/
   *
   * @param missionId - The mission ID
   * @returns Path to the created mission directory
   */
  async createMissionDirectory(missionId: string): Promise<string> {
    const dateDir = this.extractDateFromMissionId(missionId);
    const missionDir = path.join(this.workPath, dateDir, missionId);

    if (!fs.existsSync(missionDir)) {
      fs.mkdirSync(missionDir, { recursive: true });
    }

    return missionDir;
  }

  /**
   * Get the path to a mission directory.
   *
   * @param missionId - The mission ID
   * @returns Path to the mission directory
   */
  getMissionPath(missionId: string): string {
    const dateDir = this.extractDateFromMissionId(missionId);
    return path.join(this.workPath, dateDir, missionId);
  }

  /**
   * Create a new mission with metadata.
   *
   * @param metadata - Mission metadata
   */
  async createMission(metadata: MissionMetadata): Promise<void> {
    await this.createMissionDirectory(metadata.missionId);

    const missionDir = this.getMissionPath(metadata.missionId);
    const metadataPath = path.join(missionDir, "mission-metadata.json");

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");

    // Initialize empty log file
    const logPath = path.join(missionDir, "mission.log");
    if (!fs.existsSync(logPath)) {
      fs.writeFileSync(logPath, "", "utf-8");
    }
  }

  /**
   * Update mission status.
   *
   * @param missionId - The mission ID
   * @param status - New status
   */
  async updateMissionStatus(missionId: string, status: MissionStatus): Promise<void> {
    const missionDir = this.getMissionPath(missionId);
    const metadataPath = path.join(missionDir, "mission-metadata.json");

    if (!fs.existsSync(metadataPath)) {
      throw new Error(`Mission not found: ${missionId}`);
    }

    const metadata: MissionMetadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
    metadata.status = status;

    if (status === "COMPLETED" || status === "FAILED") {
      metadata.completedAt = new Date().toISOString();
    }

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");
  }

  /**
   * Append an entry to the mission log.
   *
   * Uses append mode to handle concurrent writes safely.
   *
   * @param missionId - The mission ID
   * @param logEntry - Log entry to append
   */
  async appendMissionLog(missionId: string, logEntry: MissionLog): Promise<void> {
    const missionDir = this.getMissionPath(missionId);
    const logPath = path.join(missionDir, "mission.log");

    const logLine = JSON.stringify(logEntry) + "\n";

    // Use appendFileSync for atomic append (handles concurrency better)
    fs.appendFileSync(logPath, logLine, "utf-8");
  }

  /**
   * Load mission metadata.
   *
   * @param missionId - The mission ID
   * @returns Mission metadata or null if not found
   */
  async loadMissionMetadata(missionId: string): Promise<MissionMetadata | null> {
    const missionDir = this.getMissionPath(missionId);
    const metadataPath = path.join(missionDir, "mission-metadata.json");

    if (!fs.existsSync(metadataPath)) {
      return null;
    }

    return JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
  }

  /**
   * List all missions for a specific date.
   *
   * @param date - Date in YYYY-MM-DD format
   * @returns Array of mission summaries
   */
  async listMissionsByDate(date: string): Promise<MissionSummary[]> {
    const datePath = path.join(this.workPath, date);

    if (!fs.existsSync(datePath)) {
      return [];
    }

    const missions: MissionSummary[] = [];
    const entries = fs.readdirSync(datePath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const missionId = entry.name;
      const missionDir = path.join(datePath, missionId);
      const metadataPath = path.join(missionDir, "mission-metadata.json");

      if (fs.existsSync(metadataPath)) {
        try {
          const metadata: MissionMetadata = JSON.parse(
            fs.readFileSync(metadataPath, "utf-8")
          );

          // Try to load ISC for satisfaction rate
          let satisfactionRate: number | undefined;
          const iscPath = path.join(missionDir, "ISC.json");
          if (fs.existsSync(iscPath)) {
            try {
              const isc: ISCState = JSON.parse(fs.readFileSync(iscPath, "utf-8"));
              satisfactionRate = isc.satisfaction.rate;
            } catch {
              // Ignore ISC parse errors
            }
          }

          missions.push({
            missionId: metadata.missionId,
            target: metadata.target,
            service: metadata.service,
            status: metadata.status,
            startedAt: metadata.startedAt,
            completedAt: metadata.completedAt,
            satisfactionRate,
            path: missionDir,
          });
        } catch {
          // Skip malformed metadata files
        }
      }
    }

    return missions;
  }

  /**
   * Save ISC state to mission directory.
   *
   * @param missionId - The mission ID
   * @param iscState - ISC state to save
   */
  async saveISC(missionId: string, iscState: ISCState): Promise<void> {
    const missionDir = this.getMissionPath(missionId);
    const iscPath = path.join(missionDir, "ISC.json");

    fs.writeFileSync(iscPath, JSON.stringify(iscState, null, 2), "utf-8");
  }

  /**
   * Load ISC state from mission directory.
   *
   * @param missionId - The mission ID
   * @returns ISC state or null if not found
   */
  async loadISC(missionId: string): Promise<ISCState | null> {
    const missionDir = this.getMissionPath(missionId);
    const iscPath = path.join(missionDir, "ISC.json");

    if (!fs.existsSync(iscPath)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(iscPath, "utf-8"));
    } catch {
      return null;
    }
  }

  /**
   * Get all dates that have mission data.
   *
   * @returns Array of date strings in YYYY-MM-DD format
   */
  async getActiveDates(): Promise<string[]> {
    if (!fs.existsSync(this.workPath)) {
      return [];
    }

    const entries = fs.readdirSync(this.workPath, { withFileTypes: true });
    const dates: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name)) {
        dates.push(entry.name);
      }
    }

    return dates.sort();
  }

  /**
   * Save arbitrary data to the mission directory.
   *
   * @param missionId - The mission ID
   * @param filename - Name of the file to save
   * @param data - Data to save (will be JSON stringified)
   */
  async saveMissionData(missionId: string, filename: string, data: unknown): Promise<void> {
    const missionDir = this.getMissionPath(missionId);
    const filePath = path.join(missionDir, filename);

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  }

  /**
   * Load arbitrary data from the mission directory.
   *
   * @param missionId - The mission ID
   * @param filename - Name of the file to load
   * @returns Parsed data or null if not found
   */
  async loadMissionData<T = unknown>(missionId: string, filename: string): Promise<T | null> {
    const missionDir = this.getMissionPath(missionId);
    const filePath = path.join(missionDir, filename);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      return null;
    }
  }

  /**
   * Get the LEARNING directory path.
   */
  getLearningPath(): string {
    return this.learningPath;
  }
}
