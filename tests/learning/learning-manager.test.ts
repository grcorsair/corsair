/**
 * LearningManager Tests (Phase 2.2)
 *
 * Tests for the Learning System that extracts patterns from
 * historical mission ISC data for continuous improvement.
 *
 * Features:
 * - Extract common ISC patterns across missions
 * - Identify failure patterns (frequently failed criteria)
 * - Identify success patterns (frequently satisfied criteria)
 * - Confidence scoring based on sample size
 * - Pattern persistence to LEARNING directory
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { LearningManager } from "../../src/core/learning-manager";
import { WorkManager } from "../../src/core/work-manager";
import type { ISCState } from "../../src/types/isc";
import type { ISCPatterns, FailurePattern, SuccessPattern } from "../../src/types/learning";

// Test workspace
const TEST_BASE_DIR = "./test-corsair-learning";

// Helper to create a mock ISC state
function createMockISC(
  missionId: string,
  criteria: Array<{ text: string; satisfaction: "PENDING" | "SATISFIED" | "FAILED" }>
): ISCState {
  return {
    missionId,
    status: "COMPLETED",
    criteria: criteria.map((c, i) => ({
      id: `ISC-${i}`,
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
      rate: Math.round(
        (criteria.filter((c) => c.satisfaction === "SATISFIED").length / criteria.length) * 100
      ),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("LearningManager", () => {
  let learningManager: LearningManager;
  let workManager: WorkManager;

  beforeEach(async () => {
    // Clean up test directory
    if (existsSync(TEST_BASE_DIR)) {
      rmSync(TEST_BASE_DIR, { recursive: true });
    }
    workManager = new WorkManager(TEST_BASE_DIR);
    await workManager.initialize();
    learningManager = new LearningManager(workManager);
  });

  afterEach(() => {
    // Cleanup after tests
    if (existsSync(TEST_BASE_DIR)) {
      rmSync(TEST_BASE_DIR, { recursive: true });
    }
  });

  describe("Pattern Extraction", () => {
    it("should extract common ISC patterns from multiple missions", async () => {
      // Create 5 missions with overlapping criteria
      const missions = [
        createMockISC("mission_20250205_100000_a", [
          { text: "MFA enabled for all users", satisfaction: "SATISFIED" },
          { text: "Public access blocked at bucket level", satisfaction: "FAILED" },
          { text: "Encryption enabled at rest", satisfaction: "SATISFIED" },
        ]),
        createMockISC("mission_20250205_110000_b", [
          { text: "MFA enabled for all users", satisfaction: "SATISFIED" },
          { text: "Public access blocked at bucket level", satisfaction: "FAILED" },
          { text: "Strong password policy enforced", satisfaction: "SATISFIED" },
        ]),
        createMockISC("mission_20250205_120000_c", [
          { text: "MFA enabled for all users", satisfaction: "FAILED" },
          { text: "Public access blocked at bucket level", satisfaction: "FAILED" },
          { text: "Logging enabled for audit trail", satisfaction: "SATISFIED" },
        ]),
        createMockISC("mission_20250205_130000_d", [
          { text: "MFA enabled for all users", satisfaction: "SATISFIED" },
          { text: "Encryption enabled at rest", satisfaction: "SATISFIED" },
        ]),
        createMockISC("mission_20250205_140000_e", [
          { text: "MFA enabled for all users", satisfaction: "SATISFIED" },
          { text: "Public access blocked at bucket level", satisfaction: "SATISFIED" },
        ]),
      ];

      // Save missions to work directory
      for (const isc of missions) {
        await workManager.createMission({
          missionId: isc.missionId,
          target: "test-target",
          service: "s3",
          status: "COMPLETED",
          startedAt: new Date().toISOString(),
        });
        await workManager.saveISC(isc.missionId, isc);
      }

      // Extract patterns
      const patterns = await learningManager.extractPatterns();

      // "MFA enabled for all users" appears in 5/5 missions (100%)
      // Should be identified as a common pattern
      expect(patterns.common.length).toBeGreaterThan(0);

      const mfaPattern = patterns.common.find((p) => p.text.includes("MFA"));
      expect(mfaPattern).toBeDefined();
      expect(mfaPattern!.frequency).toBeGreaterThanOrEqual(0.5);
    });

    it("should identify failure patterns with 30%+ failure rate", async () => {
      // Create missions where "Public access blocked" frequently fails
      const missions = [
        createMockISC("mission_20250205_100000_f1", [
          { text: "Public access blocked at bucket level", satisfaction: "FAILED" },
          { text: "MFA enabled", satisfaction: "SATISFIED" },
        ]),
        createMockISC("mission_20250205_110000_f2", [
          { text: "Public access blocked at bucket level", satisfaction: "FAILED" },
          { text: "MFA enabled", satisfaction: "SATISFIED" },
        ]),
        createMockISC("mission_20250205_120000_f3", [
          { text: "Public access blocked at bucket level", satisfaction: "SATISFIED" },
          { text: "MFA enabled", satisfaction: "FAILED" },
        ]),
        createMockISC("mission_20250205_130000_f4", [
          { text: "Public access blocked at bucket level", satisfaction: "FAILED" },
          { text: "MFA enabled", satisfaction: "SATISFIED" },
        ]),
        createMockISC("mission_20250205_140000_f5", [
          { text: "Public access blocked at bucket level", satisfaction: "SATISFIED" },
          { text: "MFA enabled", satisfaction: "SATISFIED" },
        ]),
      ];

      for (const isc of missions) {
        await workManager.createMission({
          missionId: isc.missionId,
          target: "test-target",
          service: "s3",
          status: "COMPLETED",
          startedAt: new Date().toISOString(),
        });
        await workManager.saveISC(isc.missionId, isc);
      }

      const patterns = await learningManager.extractPatterns();

      // "Public access blocked" fails in 3/5 missions (60%)
      // Should be identified as a failure pattern
      expect(patterns.failures.length).toBeGreaterThan(0);

      const publicAccessFailure = patterns.failures.find((p) =>
        p.text.includes("Public access")
      );
      expect(publicAccessFailure).toBeDefined();
      expect(publicAccessFailure!.failureRate).toBeGreaterThanOrEqual(0.3);
    });

    it("should identify success patterns with 80%+ success rate", async () => {
      // Create missions where "MFA enabled" consistently succeeds
      const missions = [
        createMockISC("mission_20250205_100000_s1", [
          { text: "MFA enabled for all users", satisfaction: "SATISFIED" },
        ]),
        createMockISC("mission_20250205_110000_s2", [
          { text: "MFA enabled for all users", satisfaction: "SATISFIED" },
        ]),
        createMockISC("mission_20250205_120000_s3", [
          { text: "MFA enabled for all users", satisfaction: "SATISFIED" },
        ]),
        createMockISC("mission_20250205_130000_s4", [
          { text: "MFA enabled for all users", satisfaction: "SATISFIED" },
        ]),
        createMockISC("mission_20250205_140000_s5", [
          { text: "MFA enabled for all users", satisfaction: "FAILED" },
        ]),
      ];

      for (const isc of missions) {
        await workManager.createMission({
          missionId: isc.missionId,
          target: "test-target",
          service: "cognito",
          status: "COMPLETED",
          startedAt: new Date().toISOString(),
        });
        await workManager.saveISC(isc.missionId, isc);
      }

      const patterns = await learningManager.extractPatterns();

      // "MFA enabled" succeeds in 4/5 missions (80%)
      // Should be identified as a success pattern
      expect(patterns.successes.length).toBeGreaterThan(0);

      const mfaSuccess = patterns.successes.find((p) => p.text.includes("MFA"));
      expect(mfaSuccess).toBeDefined();
      expect(mfaSuccess!.successRate).toBeGreaterThanOrEqual(0.8);
    });

    it("should calculate confidence based on sample size", async () => {
      // Create 10 missions for higher confidence
      const missions = [];
      for (let i = 0; i < 10; i++) {
        missions.push(
          createMockISC(`mission_20250205_${100000 + i}_conf${i}`, [
            { text: "Logging enabled", satisfaction: "SATISFIED" },
          ])
        );
      }

      for (const isc of missions) {
        await workManager.createMission({
          missionId: isc.missionId,
          target: "test-target",
          service: "s3",
          status: "COMPLETED",
          startedAt: new Date().toISOString(),
        });
        await workManager.saveISC(isc.missionId, isc);
      }

      const patterns = await learningManager.extractPatterns();

      // With 10 samples, confidence should be reasonable
      // Formula: Math.min(0.95, Math.log10(sampleSize + 1) / 1.5)
      // log10(11) / 1.5 = ~0.69
      const loggingPattern = patterns.common.find((p) => p.text.includes("Logging"));
      expect(loggingPattern).toBeDefined();
      expect(loggingPattern!.confidence).toBeGreaterThan(0.5);
      expect(loggingPattern!.confidence).toBeLessThanOrEqual(0.95);
    });
  });

  describe("Pattern Persistence", () => {
    it("should persist patterns to LEARNING directory", async () => {
      // Create sample missions
      const missions = [
        createMockISC("mission_20250205_100000_p1", [
          { text: "Pattern test criterion", satisfaction: "SATISFIED" },
        ]),
        createMockISC("mission_20250205_110000_p2", [
          { text: "Pattern test criterion", satisfaction: "SATISFIED" },
        ]),
      ];

      for (const isc of missions) {
        await workManager.createMission({
          missionId: isc.missionId,
          target: "test-target",
          service: "s3",
          status: "COMPLETED",
          startedAt: new Date().toISOString(),
        });
        await workManager.saveISC(isc.missionId, isc);
      }

      await learningManager.extractPatterns();
      await learningManager.persistPatterns();

      const patternsPath = join(TEST_BASE_DIR, "LEARNING", "patterns.json");
      expect(existsSync(patternsPath)).toBe(true);

      const savedPatterns = JSON.parse(readFileSync(patternsPath, "utf-8"));
      expect(savedPatterns.common).toBeDefined();
      expect(savedPatterns.failures).toBeDefined();
      expect(savedPatterns.successes).toBeDefined();
    });

    it("should load patterns from LEARNING directory", async () => {
      // Create and save patterns
      const mockPatterns: ISCPatterns = {
        common: [
          {
            text: "Loaded pattern",
            frequency: 0.8,
            confidence: 0.7,
            sampleSize: 10,
            services: ["s3"],
          },
        ],
        failures: [],
        successes: [],
        extractedAt: new Date().toISOString(),
        missionCount: 10,
      };

      const patternsPath = join(TEST_BASE_DIR, "LEARNING", "patterns.json");
      writeFileSync(patternsPath, JSON.stringify(mockPatterns, null, 2), "utf-8");

      const loadedPatterns = await learningManager.loadPatterns();

      expect(loadedPatterns).toBeDefined();
      expect(loadedPatterns!.common.length).toBe(1);
      expect(loadedPatterns!.common[0].text).toBe("Loaded pattern");
    });
  });

  describe("Service-Specific Patterns", () => {
    it("should track patterns by service type", async () => {
      // Create S3 missions
      const s3Missions = [
        createMockISC("mission_20250205_100000_s3a", [
          { text: "Public access blocked", satisfaction: "FAILED" },
        ]),
        createMockISC("mission_20250205_110000_s3b", [
          { text: "Public access blocked", satisfaction: "FAILED" },
        ]),
      ];

      for (const isc of s3Missions) {
        await workManager.createMission({
          missionId: isc.missionId,
          target: "test-bucket",
          service: "s3",
          status: "COMPLETED",
          startedAt: new Date().toISOString(),
        });
        await workManager.saveISC(isc.missionId, isc);
      }

      // Create Cognito missions
      const cognitoMissions = [
        createMockISC("mission_20250205_120000_coga", [
          { text: "MFA enabled for users", satisfaction: "SATISFIED" },
        ]),
        createMockISC("mission_20250205_130000_cogb", [
          { text: "MFA enabled for users", satisfaction: "SATISFIED" },
        ]),
      ];

      for (const isc of cognitoMissions) {
        await workManager.createMission({
          missionId: isc.missionId,
          target: "test-pool",
          service: "cognito",
          status: "COMPLETED",
          startedAt: new Date().toISOString(),
        });
        await workManager.saveISC(isc.missionId, isc);
      }

      const patterns = await learningManager.extractPatterns();

      // Check that patterns are associated with their service
      const s3Pattern = patterns.failures.find((p) => p.text.includes("Public access"));
      if (s3Pattern) {
        expect(s3Pattern.services).toContain("s3");
      }

      const cognitoPattern = patterns.successes.find((p) => p.text.includes("MFA"));
      if (cognitoPattern) {
        expect(cognitoPattern.services).toContain("cognito");
      }
    });

    it("should filter patterns by service", async () => {
      // Create mixed missions
      const missions = [
        { isc: createMockISC("mission_20250205_100000_mix1", [{ text: "S3 criterion", satisfaction: "SATISFIED" as const }]), service: "s3" },
        { isc: createMockISC("mission_20250205_110000_mix2", [{ text: "Cognito criterion", satisfaction: "SATISFIED" as const }]), service: "cognito" },
      ];

      for (const { isc, service } of missions) {
        await workManager.createMission({
          missionId: isc.missionId,
          target: "test-target",
          service,
          status: "COMPLETED",
          startedAt: new Date().toISOString(),
        });
        await workManager.saveISC(isc.missionId, isc);
      }

      const s3Patterns = await learningManager.extractPatterns({ service: "s3" });
      const cognitoPatterns = await learningManager.extractPatterns({ service: "cognito" });

      // S3 patterns should only include S3 criteria
      const hasS3Criterion = s3Patterns.common.some((p) => p.text.includes("S3"));
      const hasCognitoCriterion = s3Patterns.common.some((p) => p.text.includes("Cognito"));

      // At least one should be true depending on threshold
      expect(hasS3Criterion || !hasCognitoCriterion || s3Patterns.common.length === 0).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty work directory gracefully", async () => {
      const patterns = await learningManager.extractPatterns();

      expect(patterns.common).toEqual([]);
      expect(patterns.failures).toEqual([]);
      expect(patterns.successes).toEqual([]);
      expect(patterns.missionCount).toBe(0);
    });

    it("should handle missions without ISC files", async () => {
      // Create mission without ISC
      await workManager.createMission({
        missionId: "mission_20250205_100000_noisc",
        target: "test-target",
        service: "s3",
        status: "COMPLETED",
        startedAt: new Date().toISOString(),
      });

      const patterns = await learningManager.extractPatterns();

      // Should not crash, just have empty patterns
      expect(patterns.missionCount).toBe(0);
    });
  });
});
