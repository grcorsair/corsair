/**
 * MissionResumer - Mission Resume System (Phase 2.3)
 *
 * Enables detection and resumption of interrupted missions.
 *
 * Features:
 * - Find interrupted missions (IN_PROGRESS with no recent activity)
 * - Restore mission state (ISC, recon results, context)
 * - Determine last execution phase from mission.log
 * - Build resume prompts with previous context
 * - Complete mission lifecycle management
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { WorkManager } from "./work-manager";
import type { MissionMetadata, MissionLog, MissionPhase, MissionSummary } from "../types/work";
import type { ISCState } from "../types/isc";
import type { ReconResult } from "../types";

/**
 * Restored mission state including all available checkpoint data.
 */
export interface RestoredMission {
  /** Mission metadata */
  metadata: MissionMetadata;

  /** ISC state if available */
  isc: ISCState | null;

  /** Recon results if available */
  reconResults: ReconResult | null;

  /** Mark results if available */
  markResults: unknown | null;

  /** Raid results if available */
  raidResults: unknown | null;
}

/**
 * Execution state of a mission for resume decisions.
 */
export interface ExecutionState {
  /** Last phase that was active */
  lastPhase?: MissionPhase | "INIT" | "COMPLETE" | "ERROR";

  /** All log entries parsed from mission.log */
  logEntries: MissionLog[];

  /** Whether recon-results.json exists */
  hasReconResults: boolean;

  /** Whether ISC.json exists */
  hasISC: boolean;

  /** Whether mark-results.json exists */
  hasMarkResults: boolean;

  /** Whether raid-results.json exists */
  hasRaidResults: boolean;

  /** Whether plunder-results.json exists */
  hasPlunderResults: boolean;
}

export class MissionResumer {
  private workManager: WorkManager;

  constructor(workManager: WorkManager) {
    this.workManager = workManager;
  }

  /**
   * Find all interrupted missions (IN_PROGRESS status).
   *
   * @returns Array of mission summaries for interrupted missions
   */
  async findInterruptedMissions(): Promise<MissionSummary[]> {
    const interrupted: MissionSummary[] = [];
    const dates = await this.workManager.getActiveDates();

    for (const date of dates) {
      const missions = await this.workManager.listMissionsByDate(date);

      for (const mission of missions) {
        if (mission.status === "IN_PROGRESS") {
          interrupted.push(mission);
        }
      }
    }

    // Sort by start time (newest first)
    return interrupted.sort((a, b) => {
      return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
    });
  }

  /**
   * Restore complete mission state from checkpoints.
   *
   * @param missionId - Mission to restore
   * @returns Restored mission state or null if mission not found
   */
  async restoreMission(missionId: string): Promise<RestoredMission | null> {
    const metadata = await this.workManager.loadMissionMetadata(missionId);
    if (!metadata) {
      return null;
    }

    // Load ISC state
    const isc = await this.workManager.loadISC(missionId);

    // Load recon results
    const reconResults = await this.workManager.loadMissionData<ReconResult>(
      missionId,
      "recon-results.json"
    );

    // Load mark results
    const markResults = await this.workManager.loadMissionData(missionId, "mark-results.json");

    // Load raid results
    const raidResults = await this.workManager.loadMissionData(missionId, "raid-results.json");

    return {
      metadata,
      isc,
      reconResults,
      markResults,
      raidResults,
    };
  }

  /**
   * Get execution state for a mission.
   *
   * Parses mission.log to determine last phase and checks for
   * checkpoint files to understand what was completed.
   *
   * @param missionId - Mission to analyze
   * @returns Execution state
   */
  async getExecutionState(missionId: string): Promise<ExecutionState> {
    const missionDir = this.workManager.getMissionPath(missionId);
    const logEntries: MissionLog[] = [];
    let lastPhase: MissionPhase | "INIT" | "COMPLETE" | "ERROR" | undefined;

    // Parse mission.log
    const logPath = path.join(missionDir, "mission.log");
    if (fs.existsSync(logPath)) {
      try {
        const content = fs.readFileSync(logPath, "utf-8");
        const lines = content.trim().split("\n").filter((line) => line.trim());

        for (const line of lines) {
          try {
            const entry: MissionLog = JSON.parse(line);
            logEntries.push(entry);
            lastPhase = entry.phase;
          } catch {
            // Skip malformed lines
          }
        }
      } catch {
        // Log file corrupted or inaccessible
      }
    }

    // Check for checkpoint files
    const hasReconResults = fs.existsSync(path.join(missionDir, "recon-results.json"));
    const hasISC = fs.existsSync(path.join(missionDir, "ISC.json"));
    const hasMarkResults = fs.existsSync(path.join(missionDir, "mark-results.json"));
    const hasRaidResults = fs.existsSync(path.join(missionDir, "raid-results.json"));
    const hasPlunderResults = fs.existsSync(path.join(missionDir, "plunder-results.json"));

    return {
      lastPhase,
      logEntries,
      hasReconResults,
      hasISC,
      hasMarkResults,
      hasRaidResults,
      hasPlunderResults,
    };
  }

  /**
   * Build a resume prompt with context from previous execution.
   *
   * @param missionId - Mission to build resume prompt for
   * @returns Resume prompt string
   */
  async buildResumePrompt(missionId: string): Promise<string> {
    const restored = await this.restoreMission(missionId);
    if (!restored) {
      throw new Error(`Mission not found: ${missionId}`);
    }

    const execState = await this.getExecutionState(missionId);
    const { metadata, isc } = restored;

    const lines: string[] = [
      "=" .repeat(60),
      "RESUME INTERRUPTED MISSION",
      "=".repeat(60),
      "",
      `Mission ID: ${metadata.missionId}`,
      `Target: ${metadata.target}`,
      `Service: ${metadata.service}`,
      `Started: ${metadata.startedAt}`,
      `Last Phase: ${execState.lastPhase || "UNKNOWN"}`,
      "",
    ];

    // Include ISC context if available
    if (isc && isc.criteria.length > 0) {
      lines.push("Previous ISC Criteria:");
      lines.push("-".repeat(40));

      for (const criterion of isc.criteria) {
        const status =
          criterion.satisfaction === "SATISFIED"
            ? "[PASS]"
            : criterion.satisfaction === "FAILED"
            ? "[FAIL]"
            : "[----]";
        lines.push(`${status} ${criterion.text}`);
      }

      lines.push("");
      lines.push(`Satisfaction Rate: ${isc.satisfaction.rate}%`);
      lines.push("");
    }

    // Include execution state
    lines.push("Available Checkpoints:");
    lines.push(`  - Recon Results: ${execState.hasReconResults ? "YES" : "NO"}`);
    lines.push(`  - ISC State: ${execState.hasISC ? "YES" : "NO"}`);
    lines.push(`  - Mark Results: ${execState.hasMarkResults ? "YES" : "NO"}`);
    lines.push(`  - Raid Results: ${execState.hasRaidResults ? "YES" : "NO"}`);
    lines.push("");

    // Resume instructions
    lines.push("INSTRUCTIONS:");
    lines.push(`Resume this mission from the ${execState.lastPhase || "beginning"} phase.`);
    lines.push("Continue with the security testing cycle to completion.");
    lines.push("Verify all pending ISC criteria and update their status.");
    lines.push("");
    lines.push("=".repeat(60));

    return lines.join("\n");
  }

  /**
   * Mark a resumed mission as complete.
   *
   * @param missionId - Mission to mark complete
   */
  async markResumeComplete(missionId: string): Promise<void> {
    await this.workManager.updateMissionStatus(missionId, "COMPLETED");

    await this.logResumeAction(missionId, "COMPLETE", "Mission resumed and completed successfully");
  }

  /**
   * Log a resume-related action to mission.log.
   *
   * @param missionId - Mission to log action for
   * @param phase - Phase of the action
   * @param action - Action description
   */
  async logResumeAction(
    missionId: string,
    phase: "RESUMED" | "COMPLETE" | "ERROR",
    action: string
  ): Promise<void> {
    const logEntry: MissionLog = {
      timestamp: new Date().toISOString(),
      phase: phase as MissionPhase | "INIT" | "COMPLETE" | "ERROR",
      action,
      details: { resumedAt: new Date().toISOString() },
    };

    await this.workManager.appendMissionLog(missionId, logEntry);
  }

  /**
   * Check if a mission can be safely resumed.
   *
   * @param missionId - Mission to check
   * @returns Whether the mission can be resumed
   */
  async canResume(missionId: string): Promise<boolean> {
    const metadata = await this.workManager.loadMissionMetadata(missionId);
    if (!metadata) {
      return false;
    }

    // Can only resume IN_PROGRESS or INTERRUPTED missions
    return metadata.status === "IN_PROGRESS" || metadata.status === "INTERRUPTED";
  }

  /**
   * Get suggested next phase based on execution state.
   *
   * @param missionId - Mission to analyze
   * @returns Suggested next phase
   */
  async getSuggestedNextPhase(missionId: string): Promise<MissionPhase> {
    const state = await this.getExecutionState(missionId);

    // If no checkpoints, start from beginning
    if (!state.hasReconResults) {
      return "RECON";
    }

    // If recon done but no ISC/Mark, do MARK
    if (!state.hasMarkResults) {
      return "MARK";
    }

    // If mark done but no raid, do RAID
    if (!state.hasRaidResults) {
      return "RAID";
    }

    // If raid done but no plunder, do PLUNDER
    if (!state.hasPlunderResults) {
      return "PLUNDER";
    }

    // Final phase
    return "ESCAPE";
  }
}
