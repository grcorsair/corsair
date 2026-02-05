/**
 * Phase 2 Integration Tests
 *
 * End-to-end integration tests for the Memory System components:
 * - WorkManager + LearningManager + ISCIndex working together
 * - Mission lifecycle through resume capability
 * - Pattern learning from historical data
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, rmSync } from "fs";
import { join } from "path";
import { WorkManager } from "../../src/core/work-manager";
import { LearningManager } from "../../src/core/learning-manager";
import { MissionResumer } from "../../src/core/mission-resumer";
import { ISCIndex } from "../../src/core/isc-index";
import type { ISCState } from "../../src/types/isc";
import type { MissionMetadata } from "../../src/types/work";

// Test workspace
const TEST_BASE_DIR = "./test-corsair-integration";

// Helper to create mock ISC state
function createMockISC(
  missionId: string,
  criteria: Array<{ text: string; satisfaction: "PENDING" | "SATISFIED" | "FAILED" }>
): ISCState {
  return {
    missionId,
    status: "COMPLETED",
    criteria: criteria.map((c, i) => ({
      id: `ISC-${missionId}-${i}`,
      text: c.text,
      satisfaction: c.satisfaction,
      evidenceRefs: [],
      createdAt: new Date().toISOString(),
    })),
    satisfaction: {
      satisfied: criteria.filter((c) => c.satisfaction === "SATISFIED").length,
      failed: criteria.filter((c) => c.satisfaction === "FAILED").length,
      pending: criteria.filter((c) => c.satisfaction === "PENDING").length,
      total: criteria.length,
      rate:
        criteria.length > 0
          ? Math.round(
              (criteria.filter((c) => c.satisfaction === "SATISFIED").length / criteria.length) * 100
            )
          : 0,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("Phase 2 Integration", () => {
  let workManager: WorkManager;
  let learningManager: LearningManager;
  let missionResumer: MissionResumer;
  let iscIndex: ISCIndex;

  beforeEach(async () => {
    // Clean up test directory
    if (existsSync(TEST_BASE_DIR)) {
      rmSync(TEST_BASE_DIR, { recursive: true });
    }
    workManager = new WorkManager(TEST_BASE_DIR);
    await workManager.initialize();
    learningManager = new LearningManager(workManager);
    missionResumer = new MissionResumer(workManager);
    iscIndex = new ISCIndex(workManager);
  });

  afterEach(() => {
    // Cleanup after tests
    if (existsSync(TEST_BASE_DIR)) {
      rmSync(TEST_BASE_DIR, { recursive: true });
    }
  });

  describe("Complete Mission Lifecycle", () => {
    it("should support full mission lifecycle: create -> interrupt -> detect -> resume -> complete", async () => {
      // 1. Create a mission (simulating start)
      const missionId = "mission_20250205_100000_lifecycle";
      const metadata: MissionMetadata = {
        missionId,
        target: "test-bucket",
        service: "s3",
        status: "IN_PROGRESS",
        startedAt: new Date().toISOString(),
      };

      await workManager.createMission(metadata);

      // Add initial log entries
      await workManager.appendMissionLog(missionId, {
        timestamp: new Date().toISOString(),
        phase: "INIT",
        action: "Mission started",
      });

      // 2. Mission does RECON
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
      await workManager.appendMissionLog(missionId, {
        timestamp: new Date().toISOString(),
        phase: "RECON",
        action: "Recon completed",
      });

      // 3. Mission creates ISC criteria
      const iscState = createMockISC(missionId, [
        { text: "Public access blocked at bucket level", satisfaction: "PENDING" },
        { text: "Server-side encryption enabled", satisfaction: "PENDING" },
      ]);
      iscState.status = "IN_PROGRESS";

      await workManager.saveISC(missionId, iscState);
      await workManager.appendMissionLog(missionId, {
        timestamp: new Date().toISOString(),
        phase: "MARK",
        action: "Mark started - 2 criteria created",
      });

      // 4. Simulate interruption (mission is IN_PROGRESS)
      // The mission just stops without completing

      // 5. Detect interrupted mission
      const interrupted = await missionResumer.findInterruptedMissions();
      expect(interrupted.length).toBe(1);
      expect(interrupted[0].missionId).toBe(missionId);

      // 6. Get execution state for resume
      const execState = await missionResumer.getExecutionState(missionId);
      expect(execState.lastPhase).toBe("MARK");
      expect(execState.hasReconResults).toBe(true);
      expect(execState.hasISC).toBe(true);

      // 7. Restore mission state
      const restored = await missionResumer.restoreMission(missionId);
      expect(restored).toBeDefined();
      expect(restored!.metadata.status).toBe("IN_PROGRESS");
      expect(restored!.isc).toBeDefined();
      expect(restored!.isc!.criteria.length).toBe(2);
      expect(restored!.reconResults).toBeDefined();

      // 8. Generate resume prompt
      const prompt = await missionResumer.buildResumePrompt(missionId);
      expect(prompt).toContain("RESUME");
      expect(prompt).toContain("test-bucket");
      expect(prompt).toContain("MARK");

      // 9. Mark resume complete
      await missionResumer.markResumeComplete(missionId);

      // 10. Verify completion
      const finalMetadata = await workManager.loadMissionMetadata(missionId);
      expect(finalMetadata!.status).toBe("COMPLETED");
      expect(finalMetadata!.completedAt).toBeDefined();
    });
  });

  describe("Pattern Learning from Multiple Missions", () => {
    it("should learn patterns from 5+ missions and persist to LEARNING", async () => {
      // Create 5 missions with overlapping criteria patterns
      const missionData = [
        {
          id: "mission_20250205_100000_learn1",
          service: "s3",
          criteria: [
            { text: "Public access blocked at bucket level", satisfaction: "FAILED" as const },
            { text: "Server-side encryption enabled", satisfaction: "SATISFIED" as const },
          ],
        },
        {
          id: "mission_20250205_110000_learn2",
          service: "s3",
          criteria: [
            { text: "Public access blocked at bucket level", satisfaction: "FAILED" as const },
            { text: "Versioning enabled for recovery", satisfaction: "SATISFIED" as const },
          ],
        },
        {
          id: "mission_20250205_120000_learn3",
          service: "s3",
          criteria: [
            { text: "Public access blocked at bucket level", satisfaction: "SATISFIED" as const },
            { text: "Access logging enabled", satisfaction: "SATISFIED" as const },
          ],
        },
        {
          id: "mission_20250205_130000_learn4",
          service: "cognito",
          criteria: [
            { text: "MFA enabled for all users", satisfaction: "SATISFIED" as const },
            { text: "Strong password policy enforced", satisfaction: "SATISFIED" as const },
          ],
        },
        {
          id: "mission_20250205_140000_learn5",
          service: "cognito",
          criteria: [
            { text: "MFA enabled for all users", satisfaction: "SATISFIED" as const },
            { text: "Risk-based authentication configured", satisfaction: "FAILED" as const },
          ],
        },
      ];

      // Create all missions
      for (const m of missionData) {
        await workManager.createMission({
          missionId: m.id,
          target: "test-target",
          service: m.service,
          status: "COMPLETED",
          startedAt: new Date().toISOString(),
        });
        await workManager.saveISC(m.id, createMockISC(m.id, m.criteria));
      }

      // Extract patterns
      const patterns = await learningManager.extractPatterns();

      // Verify pattern extraction
      expect(patterns.missionCount).toBe(5);

      // "Public access blocked" appears in 3/5 missions (60%) - should be common
      const publicAccessPattern = patterns.common.find((p) =>
        p.text.toLowerCase().includes("public access")
      );
      expect(publicAccessPattern).toBeDefined();

      // "Public access blocked" fails 2/3 times (67%) - should be failure pattern
      const publicAccessFailure = patterns.failures.find((p) =>
        p.text.toLowerCase().includes("public access")
      );
      expect(publicAccessFailure).toBeDefined();

      // "MFA enabled" succeeds 2/2 times (100%) - should be success pattern
      const mfaSuccess = patterns.successes.find((p) =>
        p.text.toLowerCase().includes("mfa")
      );
      expect(mfaSuccess).toBeDefined();
      expect(mfaSuccess!.successRate).toBe(1);

      // Persist patterns
      await learningManager.persistPatterns();

      // Verify persistence
      const patternsPath = join(TEST_BASE_DIR, "LEARNING", "patterns.json");
      expect(existsSync(patternsPath)).toBe(true);

      // Reload patterns in new instance
      const newLearningManager = new LearningManager(workManager);
      const loadedPatterns = await newLearningManager.loadPatterns();

      expect(loadedPatterns).toBeDefined();
      expect(loadedPatterns!.missionCount).toBe(5);
    });
  });

  describe("ISC Index Search Across Missions", () => {
    it("should enable text search across indexed ISC criteria with filtering", async () => {
      // Create diverse missions
      const missions = [
        {
          id: "mission_20250201_100000_search1",
          service: "s3",
          criteria: [
            { text: "Public access blocked at bucket level", satisfaction: "SATISFIED" as const },
            { text: "Data encryption at rest enabled", satisfaction: "SATISFIED" as const },
          ],
        },
        {
          id: "mission_20250203_100000_search2",
          service: "s3",
          criteria: [
            { text: "Public endpoints protected", satisfaction: "FAILED" as const },
            { text: "Bucket versioning enabled", satisfaction: "SATISFIED" as const },
          ],
        },
        {
          id: "mission_20250205_100000_search3",
          service: "cognito",
          criteria: [
            { text: "Public registration disabled", satisfaction: "SATISFIED" as const },
            { text: "MFA authentication enabled", satisfaction: "SATISFIED" as const },
          ],
        },
      ];

      for (const m of missions) {
        await workManager.createMission({
          missionId: m.id,
          target: "test-target",
          service: m.service,
          status: "COMPLETED",
          startedAt: new Date().toISOString(),
        });
        await workManager.saveISC(m.id, createMockISC(m.id, m.criteria));
      }

      // Build index
      await iscIndex.build();

      // Verify stats
      const stats = iscIndex.getStats();
      expect(stats.totalCriteria).toBe(6);
      expect(stats.totalMissions).toBe(3);

      // Test text search: "public" should find 3 criteria
      const publicResults = await iscIndex.search("public");
      expect(publicResults.length).toBe(3);

      // Test text search: "encryption" should find 1 criterion
      const encryptionResults = await iscIndex.search("encryption");
      expect(encryptionResults.length).toBe(1);

      // Test service filter: S3 only
      const s3Results = await iscIndex.search("public", { service: "s3" });
      expect(s3Results.length).toBe(2);
      expect(s3Results.every((r) => r.service === "s3")).toBe(true);

      // Test status filter: FAILED only
      const failedResults = await iscIndex.search("public", { status: "FAILED" });
      expect(failedResults.length).toBe(1);
      expect(failedResults[0].satisfaction).toBe("FAILED");

      // Test date filter: 2025-02-05 only
      const recentResults = await iscIndex.search("public", { startDate: "2025-02-05" });
      expect(recentResults.length).toBe(1);
      expect(recentResults[0].missionId).toContain("20250205");

      // Test satisfaction rates
      const overallRate = iscIndex.getOverallSatisfactionRate();
      // 5 satisfied, 1 failed = 83%
      expect(overallRate).toBe(83);

      const s3Rate = iscIndex.getSatisfactionRateByService("s3");
      // 3 satisfied, 1 failed = 75%
      expect(s3Rate).toBe(75);

      const cognitoRate = iscIndex.getSatisfactionRateByService("cognito");
      // 2 satisfied, 0 failed = 100%
      expect(cognitoRate).toBe(100);

      // Persist and reload index
      await iscIndex.persist();

      const newIndex = new ISCIndex(workManager);
      const loaded = await newIndex.load();
      expect(loaded).toBe(true);

      const reloadedStats = newIndex.getStats();
      expect(reloadedStats.totalCriteria).toBe(6);
    });
  });
});
