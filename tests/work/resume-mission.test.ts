/**
 * Mission Resume Tests (Phase 2.3)
 *
 * Tests for the mission resume functionality that allows
 * interrupted missions to be detected and resumed.
 *
 * Features:
 * - Find interrupted missions (IN_PROGRESS status with no recent activity)
 * - Restore mission state (ISC, execution context)
 * - Get last execution phase from mission.log
 * - Resume mission from last checkpoint
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { WorkManager } from "../../src/core/work-manager";
import { MissionResumer } from "../../src/core/mission-resumer";
import type { MissionMetadata, MissionLog } from "../../src/types/work";
import type { ISCState } from "../../src/types/isc";

// Test workspace
const TEST_BASE_DIR = "./test-corsair-resume";

describe("MissionResumer", () => {
  let workManager: WorkManager;
  let resumer: MissionResumer;

  beforeEach(async () => {
    // Clean up test directory
    if (existsSync(TEST_BASE_DIR)) {
      rmSync(TEST_BASE_DIR, { recursive: true });
    }
    workManager = new WorkManager(TEST_BASE_DIR);
    await workManager.initialize();
    resumer = new MissionResumer(workManager);
  });

  afterEach(() => {
    // Cleanup after tests
    if (existsSync(TEST_BASE_DIR)) {
      rmSync(TEST_BASE_DIR, { recursive: true });
    }
  });

  describe("Find Interrupted Missions", () => {
    it("should find missions with IN_PROGRESS status", async () => {
      // Create an interrupted mission
      const interruptedMission: MissionMetadata = {
        missionId: "mission_20250205_100000_interrupted",
        target: "test-target",
        service: "s3",
        status: "IN_PROGRESS",
        startedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        lastPhase: "RECON",
      };

      await workManager.createMission(interruptedMission);

      // Create a completed mission (should not be found)
      const completedMission: MissionMetadata = {
        missionId: "mission_20250205_110000_completed",
        target: "test-target",
        service: "s3",
        status: "COMPLETED",
        startedAt: new Date(Date.now() - 7200000).toISOString(),
        completedAt: new Date(Date.now() - 3600000).toISOString(),
      };

      await workManager.createMission(completedMission);

      const interrupted = await resumer.findInterruptedMissions();

      expect(interrupted.length).toBe(1);
      expect(interrupted[0].missionId).toBe("mission_20250205_100000_interrupted");
    });

    it("should return empty array when no interrupted missions exist", async () => {
      // Create only completed missions
      await workManager.createMission({
        missionId: "mission_20250205_100000_done",
        target: "test-target",
        service: "s3",
        status: "COMPLETED",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });

      const interrupted = await resumer.findInterruptedMissions();

      expect(interrupted.length).toBe(0);
    });

    it("should sort interrupted missions by start time (newest first)", async () => {
      // Create multiple interrupted missions
      await workManager.createMission({
        missionId: "mission_20250205_100000_older",
        target: "test-target",
        service: "s3",
        status: "IN_PROGRESS",
        startedAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
      });

      await workManager.createMission({
        missionId: "mission_20250205_110000_newer",
        target: "test-target",
        service: "s3",
        status: "IN_PROGRESS",
        startedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      });

      const interrupted = await resumer.findInterruptedMissions();

      expect(interrupted.length).toBe(2);
      expect(interrupted[0].missionId).toBe("mission_20250205_110000_newer");
      expect(interrupted[1].missionId).toBe("mission_20250205_100000_older");
    });
  });

  describe("Restore Mission State", () => {
    it("should restore ISC state from mission directory", async () => {
      const missionId = "mission_20250205_120000_restore";

      await workManager.createMission({
        missionId,
        target: "test-target",
        service: "cognito",
        status: "IN_PROGRESS",
        startedAt: new Date().toISOString(),
      });

      // Save ISC state
      const iscState: ISCState = {
        missionId,
        status: "IN_PROGRESS",
        criteria: [
          {
            id: "ISC-1",
            text: "MFA enabled for all users",
            satisfaction: "SATISFIED",
            evidenceRefs: ["drift-001"],
            createdAt: new Date().toISOString(),
            verifiedAt: new Date().toISOString(),
          },
          {
            id: "ISC-2",
            text: "Strong password policy enforced",
            satisfaction: "PENDING",
            evidenceRefs: [],
            createdAt: new Date().toISOString(),
          },
        ],
        satisfaction: { satisfied: 1, failed: 0, pending: 1, total: 2, rate: 50 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await workManager.saveISC(missionId, iscState);

      const restored = await resumer.restoreMission(missionId);

      expect(restored).toBeDefined();
      expect(restored!.isc).toBeDefined();
      expect(restored!.isc!.criteria.length).toBe(2);
      expect(restored!.isc!.satisfaction.satisfied).toBe(1);
    });

    it("should restore recon results if available", async () => {
      const missionId = "mission_20250205_130000_recon";

      await workManager.createMission({
        missionId,
        target: "test-bucket",
        service: "s3",
        status: "IN_PROGRESS",
        startedAt: new Date().toISOString(),
        lastPhase: "RECON",
      });

      // Save recon results
      const reconResults = {
        snapshotId: "test-bucket",
        snapshot: {
          bucketName: "test-bucket",
          publicAccessBlock: false,
          encryption: null,
          versioning: "Disabled",
          logging: false,
        },
        metadata: { source: "aws", readonly: true, durationMs: 500 },
        stateModified: false,
        durationMs: 500,
      };

      await workManager.saveMissionData(missionId, "recon-results.json", reconResults);

      const restored = await resumer.restoreMission(missionId);

      expect(restored).toBeDefined();
      expect(restored!.reconResults).toBeDefined();
      expect(restored!.reconResults!.snapshotId).toBe("test-bucket");
    });
  });

  describe("Get Execution State", () => {
    it("should parse mission log to determine last phase", async () => {
      const missionId = "mission_20250205_140000_phases";

      await workManager.createMission({
        missionId,
        target: "test-target",
        service: "s3",
        status: "IN_PROGRESS",
        startedAt: new Date().toISOString(),
      });

      // Add log entries
      const logEntries: MissionLog[] = [
        { timestamp: new Date(Date.now() - 3000).toISOString(), phase: "INIT", action: "Mission started" },
        { timestamp: new Date(Date.now() - 2000).toISOString(), phase: "RECON", action: "Recon complete" },
        { timestamp: new Date(Date.now() - 1000).toISOString(), phase: "MARK", action: "Mark started" },
      ];

      for (const entry of logEntries) {
        await workManager.appendMissionLog(missionId, entry);
      }

      const state = await resumer.getExecutionState(missionId);

      expect(state.lastPhase).toBe("MARK");
      expect(state.logEntries.length).toBe(3);
    });

    it("should check for existence of checkpoint files", async () => {
      const missionId = "mission_20250205_150000_checkpoints";

      await workManager.createMission({
        missionId,
        target: "test-target",
        service: "s3",
        status: "IN_PROGRESS",
        startedAt: new Date().toISOString(),
      });

      // Create some checkpoint files
      await workManager.saveMissionData(missionId, "recon-results.json", { test: true });
      await workManager.saveISC(missionId, {
        missionId,
        status: "IN_PROGRESS",
        criteria: [],
        satisfaction: { satisfied: 0, failed: 0, pending: 0, total: 0, rate: 0 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const state = await resumer.getExecutionState(missionId);

      expect(state.hasReconResults).toBe(true);
      expect(state.hasISC).toBe(true);
      expect(state.hasRaidResults).toBe(false);
    });
  });

  describe("Build Resume Prompt", () => {
    it("should generate resume prompt with previous ISC context", async () => {
      const missionId = "mission_20250205_160000_prompt";

      await workManager.createMission({
        missionId,
        target: "test-bucket",
        service: "s3",
        status: "IN_PROGRESS",
        startedAt: new Date().toISOString(),
        lastPhase: "MARK",
      });

      // Save ISC with some satisfied criteria
      await workManager.saveISC(missionId, {
        missionId,
        status: "IN_PROGRESS",
        criteria: [
          {
            id: "ISC-1",
            text: "Public access blocked at bucket level",
            satisfaction: "FAILED",
            evidenceRefs: ["drift-001"],
            createdAt: new Date().toISOString(),
          },
        ],
        satisfaction: { satisfied: 0, failed: 1, pending: 0, total: 1, rate: 0 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Add log entry to establish last phase
      await workManager.appendMissionLog(missionId, {
        timestamp: new Date().toISOString(),
        phase: "MARK",
        action: "Mark phase started",
      });

      const prompt = await resumer.buildResumePrompt(missionId);

      expect(prompt).toContain("RESUME");
      expect(prompt).toContain("test-bucket");
      expect(prompt).toContain("MARK");
      expect(prompt).toContain("Public access blocked");
    });
  });

  describe("Resume Mission Lifecycle", () => {
    it("should mark mission as COMPLETED on successful resume", async () => {
      const missionId = "mission_20250205_170000_complete";

      await workManager.createMission({
        missionId,
        target: "test-target",
        service: "s3",
        status: "IN_PROGRESS",
        startedAt: new Date().toISOString(),
      });

      // Simulate resume completion
      await resumer.markResumeComplete(missionId);

      const metadata = await workManager.loadMissionMetadata(missionId);

      expect(metadata?.status).toBe("COMPLETED");
      expect(metadata?.completedAt).toBeDefined();
    });

    it("should append resume log entry", async () => {
      const missionId = "mission_20250205_180000_log";

      await workManager.createMission({
        missionId,
        target: "test-target",
        service: "s3",
        status: "IN_PROGRESS",
        startedAt: new Date().toISOString(),
      });

      await resumer.logResumeAction(missionId, "RESUMED", "Mission resumed from MARK phase");

      const missionDir = workManager.getMissionPath(missionId);
      const logPath = join(missionDir, "mission.log");
      const logContent = readFileSync(logPath, "utf-8");

      expect(logContent).toContain("RESUMED");
      expect(logContent).toContain("Mission resumed from MARK phase");
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing mission gracefully", async () => {
      const restored = await resumer.restoreMission("nonexistent_mission_id");

      expect(restored).toBeNull();
    });

    it("should handle corrupted log file gracefully", async () => {
      const missionId = "mission_20250205_190000_corrupt";

      await workManager.createMission({
        missionId,
        target: "test-target",
        service: "s3",
        status: "IN_PROGRESS",
        startedAt: new Date().toISOString(),
      });

      // Write corrupted log
      const missionDir = workManager.getMissionPath(missionId);
      const logPath = join(missionDir, "mission.log");
      writeFileSync(logPath, "invalid json content\n{broken", "utf-8");

      const state = await resumer.getExecutionState(missionId);

      // Should not crash, just have partial data
      expect(state.lastPhase).toBeUndefined();
      expect(state.logEntries.length).toBe(0);
    });
  });
});
