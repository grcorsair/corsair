/**
 * Work Directory Type Definitions (Phase 2.1)
 *
 * Types for the mission work directory system that organizes
 * mission data by date and provides lifecycle management.
 */

import type { ISCState } from "./isc";

/**
 * Mission status throughout its lifecycle.
 */
export type MissionStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "INTERRUPTED";

/**
 * Mission phase for tracking execution progress.
 */
export type MissionPhase = "RECON" | "MARK" | "RAID" | "PLUNDER" | "CHART" | "ESCAPE";

/**
 * Metadata for a mission instance.
 * Stored as mission-metadata.json in the mission directory.
 */
export interface MissionMetadata {
  /** Unique mission identifier (format: mission_YYYYMMDD_HHMMSS_random) */
  missionId: string;

  /** Target resource identifier */
  target: string;

  /** Service type being tested */
  service: "cognito" | "s3" | string;

  /** Current mission status */
  status: MissionStatus;

  /** ISO-8601 timestamp when mission started */
  startedAt: string;

  /** ISO-8601 timestamp when mission completed (if applicable) */
  completedAt?: string;

  /** Last phase executed (for resume capability) */
  lastPhase?: MissionPhase;

  /** Additional mission context */
  context?: Record<string, unknown>;

  /** Error information if mission failed */
  error?: {
    message: string;
    phase?: MissionPhase;
    timestamp: string;
  };
}

/**
 * Single log entry in mission.log file.
 */
export interface MissionLog {
  /** ISO-8601 timestamp of the log entry */
  timestamp: string;

  /** Mission phase this entry relates to */
  phase: MissionPhase | "INIT" | "COMPLETE" | "ERROR";

  /** Human-readable action description */
  action: string;

  /** Additional structured details */
  details?: Record<string, unknown>;
}

/**
 * Work directory structure information.
 */
export interface WorkDirectory {
  /** Base path for all work data (e.g., ./corsair-work) */
  basePath: string;

  /** Path to WORK directory (basePath/WORK) */
  workPath: string;

  /** Path to LEARNING directory (basePath/LEARNING) */
  learningPath: string;

  /** Whether the directory structure is initialized */
  initialized: boolean;
}

/**
 * Summary of a mission for listing purposes.
 */
export interface MissionSummary {
  /** Mission ID */
  missionId: string;

  /** Target resource */
  target: string;

  /** Service type */
  service: string;

  /** Mission status */
  status: MissionStatus;

  /** Start timestamp */
  startedAt: string;

  /** Completion timestamp (if completed) */
  completedAt?: string;

  /** ISC satisfaction rate (if available) */
  satisfactionRate?: number;

  /** Path to mission directory */
  path: string;
}

/**
 * Result of scanning work directory for missions.
 */
export interface WorkScanResult {
  /** Total missions found */
  totalMissions: number;

  /** Missions by date */
  byDate: Map<string, MissionSummary[]>;

  /** Missions by status */
  byStatus: Record<MissionStatus, MissionSummary[]>;

  /** Missions with errors */
  interrupted: MissionSummary[];
}

/**
 * Options for creating a mission directory.
 */
export interface CreateMissionOptions {
  /** Force creation even if directory exists */
  force?: boolean;

  /** Initial ISC state to save */
  initialISC?: ISCState;
}
