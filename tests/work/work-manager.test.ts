/**
 * WorkManager Tests (Phase 2.1)
 *
 * Tests for the Work Directory system that organizes mission data
 * by date and provides mission lifecycle management.
 *
 * Directory structure:
 * corsair-work/
 *   WORK/
 *     YYYY-MM-DD/
 *       {missionId}/
 *         ISC.json
 *         mission.log
 *         recon-results.json
 *         ...
 *   LEARNING/
 *     patterns.json
 *     isc-index.json
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { WorkManager } from "../../src/core/work-manager";
import type { MissionMetadata, MissionLog, WorkDirectory } from "../../src/types/work";

// Test workspace
const TEST_BASE_DIR = "./test-corsair-work";

describe("WorkManager", () => {
  let workManager: WorkManager;

  beforeEach(() => {
    // Clean up test directory
    if (existsSync(TEST_BASE_DIR)) {
      rmSync(TEST_BASE_DIR, { recursive: true });
    }
    workManager = new WorkManager(TEST_BASE_DIR);
  });

  afterEach(() => {
    // Cleanup after tests
    if (existsSync(TEST_BASE_DIR)) {
      rmSync(TEST_BASE_DIR, { recursive: true });
    }
  });

  describe("Directory Structure", () => {
    it("should create WORK directory on initialization", async () => {
      await workManager.initialize();

      const workPath = join(TEST_BASE_DIR, "WORK");
      expect(existsSync(workPath)).toBe(true);
    });

    it("should create LEARNING directory on initialization", async () => {
      await workManager.initialize();

      const learningPath = join(TEST_BASE_DIR, "LEARNING");
      expect(existsSync(learningPath)).toBe(true);
    });

    it("should create date-based subdirectory for mission", async () => {
      await workManager.initialize();

      const missionId = "mission_20250205_143000_abc123";
      const missionDir = await workManager.createMissionDirectory(missionId);

      // Should be in WORK/2025-02-05/{missionId}/
      expect(missionDir).toContain("WORK");
      expect(missionDir).toContain("2025-02-05");
      expect(missionDir).toContain(missionId);
      expect(existsSync(missionDir)).toBe(true);
    });

    it("should extract date from mission ID correctly", () => {
      const missionId = "mission_20250205_143000_xyz789";
      const date = workManager.extractDateFromMissionId(missionId);

      expect(date).toBe("2025-02-05");
    });
  });

  describe("Mission Lifecycle", () => {
    it("should create mission metadata file", async () => {
      await workManager.initialize();

      const missionId = "mission_20250205_150000_def456";
      const metadata: MissionMetadata = {
        missionId,
        target: "test-bucket",
        service: "s3",
        status: "IN_PROGRESS",
        startedAt: new Date().toISOString(),
      };

      await workManager.createMission(metadata);

      const missionDir = workManager.getMissionPath(missionId);
      const metadataPath = join(missionDir, "mission-metadata.json");
      expect(existsSync(metadataPath)).toBe(true);

      const savedMetadata = JSON.parse(readFileSync(metadataPath, "utf-8"));
      expect(savedMetadata.missionId).toBe(missionId);
      expect(savedMetadata.target).toBe("test-bucket");
      expect(savedMetadata.service).toBe("s3");
    });

    it("should update mission status", async () => {
      await workManager.initialize();

      const missionId = "mission_20250205_160000_ghi789";
      const metadata: MissionMetadata = {
        missionId,
        target: "test-pool",
        service: "cognito",
        status: "IN_PROGRESS",
        startedAt: new Date().toISOString(),
      };

      await workManager.createMission(metadata);
      await workManager.updateMissionStatus(missionId, "COMPLETED");

      const missionDir = workManager.getMissionPath(missionId);
      const metadataPath = join(missionDir, "mission-metadata.json");
      const savedMetadata = JSON.parse(readFileSync(metadataPath, "utf-8"));

      expect(savedMetadata.status).toBe("COMPLETED");
      expect(savedMetadata.completedAt).toBeDefined();
    });

    it("should append to mission log", async () => {
      await workManager.initialize();

      const missionId = "mission_20250205_170000_jkl012";
      const metadata: MissionMetadata = {
        missionId,
        target: "test-resource",
        service: "s3",
        status: "IN_PROGRESS",
        startedAt: new Date().toISOString(),
      };

      await workManager.createMission(metadata);

      const logEntry: MissionLog = {
        timestamp: new Date().toISOString(),
        phase: "RECON",
        action: "Started reconnaissance",
        details: { snapshotId: "snap-123" },
      };

      await workManager.appendMissionLog(missionId, logEntry);

      const missionDir = workManager.getMissionPath(missionId);
      const logPath = join(missionDir, "mission.log");
      expect(existsSync(logPath)).toBe(true);

      const logContent = readFileSync(logPath, "utf-8");
      expect(logContent).toContain("RECON");
      expect(logContent).toContain("Started reconnaissance");
    });

    it("should list missions by date", async () => {
      await workManager.initialize();

      // Create two missions with same date
      const missionId1 = "mission_20250205_180000_mno345";
      const missionId2 = "mission_20250205_190000_pqr678";

      await workManager.createMission({
        missionId: missionId1,
        target: "target1",
        service: "s3",
        status: "COMPLETED",
        startedAt: new Date().toISOString(),
      });

      await workManager.createMission({
        missionId: missionId2,
        target: "target2",
        service: "cognito",
        status: "IN_PROGRESS",
        startedAt: new Date().toISOString(),
      });

      const missions = await workManager.listMissionsByDate("2025-02-05");

      expect(missions.length).toBe(2);
      expect(missions.some((m) => m.missionId === missionId1)).toBe(true);
      expect(missions.some((m) => m.missionId === missionId2)).toBe(true);
    });
  });

  describe("File Operations", () => {
    it("should save ISC file to mission directory", async () => {
      await workManager.initialize();

      const missionId = "mission_20250205_200000_stu901";
      await workManager.createMission({
        missionId,
        target: "test-target",
        service: "s3",
        status: "IN_PROGRESS",
        startedAt: new Date().toISOString(),
      });

      const iscData = {
        missionId,
        status: "IN_PROGRESS",
        criteria: [
          { id: "ISC-1", text: "Public access blocked at bucket level", satisfaction: "PENDING" },
        ],
        satisfaction: { satisfied: 0, failed: 0, pending: 1, total: 1, rate: 0 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await workManager.saveISC(missionId, iscData);

      const missionDir = workManager.getMissionPath(missionId);
      const iscPath = join(missionDir, "ISC.json");
      expect(existsSync(iscPath)).toBe(true);

      const savedISC = JSON.parse(readFileSync(iscPath, "utf-8"));
      expect(savedISC.missionId).toBe(missionId);
      expect(savedISC.criteria.length).toBe(1);
    });

    it("should load ISC file from mission directory", async () => {
      await workManager.initialize();

      const missionId = "mission_20250205_210000_vwx234";
      await workManager.createMission({
        missionId,
        target: "test-target",
        service: "cognito",
        status: "IN_PROGRESS",
        startedAt: new Date().toISOString(),
      });

      const iscData = {
        missionId,
        status: "COMPLETED",
        criteria: [
          { id: "ISC-1", text: "MFA enabled for all users", satisfaction: "SATISFIED" },
          { id: "ISC-2", text: "Strong password policy enforced", satisfaction: "FAILED" },
        ],
        satisfaction: { satisfied: 1, failed: 1, pending: 0, total: 2, rate: 50 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await workManager.saveISC(missionId, iscData);

      const loadedISC = await workManager.loadISC(missionId);

      expect(loadedISC).toBeDefined();
      expect(loadedISC!.missionId).toBe(missionId);
      expect(loadedISC!.criteria.length).toBe(2);
      expect(loadedISC!.satisfaction.rate).toBe(50);
    });
  });

  describe("Mission Metadata Loading", () => {
    it("should load mission metadata that was previously created", async () => {
      await workManager.initialize();

      const missionId = "mission_20250205_230000_load1";
      const metadata: MissionMetadata = {
        missionId,
        target: "load-test-target",
        service: "cognito",
        status: "IN_PROGRESS",
        startedAt: new Date().toISOString(),
      };

      await workManager.createMission(metadata);

      const loaded = await workManager.loadMissionMetadata(missionId);

      expect(loaded).toBeDefined();
      expect(loaded!.missionId).toBe(missionId);
      expect(loaded!.target).toBe("load-test-target");
      expect(loaded!.service).toBe("cognito");
      expect(loaded!.status).toBe("IN_PROGRESS");
    });

    it("should return null for non-existent mission metadata", async () => {
      await workManager.initialize();

      const loaded = await workManager.loadMissionMetadata("mission_20991231_235959_ghost");

      expect(loaded).toBeNull();
    });

    it("should set completedAt when updating status to COMPLETED", async () => {
      await workManager.initialize();

      const missionId = "mission_20250205_230100_comp1";
      await workManager.createMission({
        missionId,
        target: "completion-target",
        service: "s3",
        status: "IN_PROGRESS",
        startedAt: new Date().toISOString(),
      });

      await workManager.updateMissionStatus(missionId, "COMPLETED");

      const loaded = await workManager.loadMissionMetadata(missionId);

      expect(loaded!.status).toBe("COMPLETED");
      expect(loaded!.completedAt).toBeDefined();
      // completedAt should be a valid ISO string
      expect(new Date(loaded!.completedAt!).getTime()).toBeGreaterThan(0);
    });

    it("should set completedAt when updating status to FAILED", async () => {
      await workManager.initialize();

      const missionId = "mission_20250205_230200_fail1";
      await workManager.createMission({
        missionId,
        target: "fail-target",
        service: "s3",
        status: "IN_PROGRESS",
        startedAt: new Date().toISOString(),
      });

      await workManager.updateMissionStatus(missionId, "FAILED");

      const loaded = await workManager.loadMissionMetadata(missionId);

      expect(loaded!.status).toBe("FAILED");
      expect(loaded!.completedAt).toBeDefined();
    });
  });

  describe("Active Dates and Mission Listing", () => {
    it("should return sorted list of active dates", async () => {
      await workManager.initialize();

      // Create missions across different dates
      await workManager.createMission({
        missionId: "mission_20250210_100000_date1",
        target: "target-a",
        service: "s3",
        status: "COMPLETED",
        startedAt: new Date().toISOString(),
      });

      await workManager.createMission({
        missionId: "mission_20250205_100000_date2",
        target: "target-b",
        service: "s3",
        status: "COMPLETED",
        startedAt: new Date().toISOString(),
      });

      await workManager.createMission({
        missionId: "mission_20250208_100000_date3",
        target: "target-c",
        service: "cognito",
        status: "IN_PROGRESS",
        startedAt: new Date().toISOString(),
      });

      const dates = await workManager.getActiveDates();

      expect(dates.length).toBe(3);
      // Should be sorted chronologically
      expect(dates[0]).toBe("2025-02-05");
      expect(dates[1]).toBe("2025-02-08");
      expect(dates[2]).toBe("2025-02-10");
    });

    it("should return empty array when no active dates exist", async () => {
      await workManager.initialize();

      const dates = await workManager.getActiveDates();

      expect(dates).toEqual([]);
    });

    it("should return empty array for listMissionsByDate with unknown date", async () => {
      await workManager.initialize();

      const missions = await workManager.listMissionsByDate("2099-12-31");

      expect(missions).toEqual([]);
    });
  });

  describe("Arbitrary Mission Data", () => {
    it("should round-trip arbitrary data via saveMissionData and loadMissionData", async () => {
      await workManager.initialize();

      const missionId = "mission_20250205_230300_arb1";
      await workManager.createMission({
        missionId,
        target: "arb-target",
        service: "s3",
        status: "IN_PROGRESS",
        startedAt: new Date().toISOString(),
      });

      const testData = {
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

      await workManager.saveMissionData(missionId, "recon-results.json", testData);

      const loaded = await workManager.loadMissionData(missionId, "recon-results.json");

      expect(loaded).toBeDefined();
      expect((loaded as any).snapshotId).toBe("test-bucket");
      expect((loaded as any).snapshot.bucketName).toBe("test-bucket");
      expect((loaded as any).durationMs).toBe(500);
    });

    it("should return null when loading non-existent mission data file", async () => {
      await workManager.initialize();

      const missionId = "mission_20250205_230400_nodata";
      await workManager.createMission({
        missionId,
        target: "nodata-target",
        service: "s3",
        status: "IN_PROGRESS",
        startedAt: new Date().toISOString(),
      });

      const loaded = await workManager.loadMissionData(missionId, "nonexistent-file.json");

      expect(loaded).toBeNull();
    });
  });

  describe("ISC Round-Trip", () => {
    it("should return null when loading ISC for non-existent mission", async () => {
      await workManager.initialize();

      const loaded = await workManager.loadISC("mission_20991231_235959_noiscp");

      expect(loaded).toBeNull();
    });
  });

  describe("Error Handling", () => {
    it("should handle missing mission directory gracefully", async () => {
      await workManager.initialize();

      const nonExistentMissionId = "mission_20250101_000000_nonexistent";
      const isc = await workManager.loadISC(nonExistentMissionId);

      expect(isc).toBeNull();
    });

    it("should handle concurrent mission writes", async () => {
      await workManager.initialize();

      const missionId = "mission_20250205_220000_concurrent";
      const metadata: MissionMetadata = {
        missionId,
        target: "concurrent-target",
        service: "s3",
        status: "IN_PROGRESS",
        startedAt: new Date().toISOString(),
      };

      await workManager.createMission(metadata);

      // Simulate concurrent log writes
      const writes = Promise.all([
        workManager.appendMissionLog(missionId, {
          timestamp: new Date().toISOString(),
          phase: "RECON",
          action: "Action 1",
        }),
        workManager.appendMissionLog(missionId, {
          timestamp: new Date().toISOString(),
          phase: "MARK",
          action: "Action 2",
        }),
        workManager.appendMissionLog(missionId, {
          timestamp: new Date().toISOString(),
          phase: "RAID",
          action: "Action 3",
        }),
      ]);

      await writes;

      const missionDir = workManager.getMissionPath(missionId);
      const logPath = join(missionDir, "mission.log");
      const logContent = readFileSync(logPath, "utf-8");

      // All entries should be present (order may vary)
      expect(logContent).toContain("Action 1");
      expect(logContent).toContain("Action 2");
      expect(logContent).toContain("Action 3");
    });
  });
});
