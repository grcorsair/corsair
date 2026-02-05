/**
 * ISCIndex Tests (Phase 2.4)
 *
 * Tests for the ISC indexing system that enables fast search
 * across historical mission ISC data.
 *
 * Features:
 * - Build word-based text index for criteria
 * - Search criteria by text query
 * - Filter by service, status, date range
 * - Calculate satisfaction rates across missions
 * - Persist index to LEARNING directory
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { ISCIndex } from "../../src/core/isc-index";
import { WorkManager } from "../../src/core/work-manager";
import type { ISCState } from "../../src/types/isc";

// Test workspace
const TEST_BASE_DIR = "./test-corsair-index";

// Helper to create a mock ISC state
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
      rate: Math.round(
        (criteria.filter((c) => c.satisfaction === "SATISFIED").length / criteria.length) * 100
      ),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("ISCIndex", () => {
  let workManager: WorkManager;
  let iscIndex: ISCIndex;

  beforeEach(async () => {
    // Clean up test directory
    if (existsSync(TEST_BASE_DIR)) {
      rmSync(TEST_BASE_DIR, { recursive: true });
    }
    workManager = new WorkManager(TEST_BASE_DIR);
    await workManager.initialize();
    iscIndex = new ISCIndex(workManager);
  });

  afterEach(() => {
    // Cleanup after tests
    if (existsSync(TEST_BASE_DIR)) {
      rmSync(TEST_BASE_DIR, { recursive: true });
    }
  });

  describe("Index Building", () => {
    it("should build word-based index from ISC criteria", async () => {
      // Create mission with criteria
      const missionId = "mission_20250205_100000_idx1";
      await workManager.createMission({
        missionId,
        target: "test-bucket",
        service: "s3",
        status: "COMPLETED",
        startedAt: new Date().toISOString(),
      });

      await workManager.saveISC(
        missionId,
        createMockISC(missionId, [
          { text: "Public access blocked at bucket level", satisfaction: "SATISFIED" },
          { text: "Encryption enabled for data at rest", satisfaction: "FAILED" },
        ])
      );

      await iscIndex.build();

      // Index should contain entries for key words
      const stats = iscIndex.getStats();
      expect(stats.totalCriteria).toBe(2);
      expect(stats.totalMissions).toBe(1);
      expect(stats.wordCount).toBeGreaterThan(0);
    });

    it("should index multiple missions", async () => {
      // Create multiple missions
      const missions = [
        {
          id: "mission_20250205_100000_multi1",
          service: "s3",
          criteria: [{ text: "Public access blocked", satisfaction: "SATISFIED" as const }],
        },
        {
          id: "mission_20250205_110000_multi2",
          service: "cognito",
          criteria: [{ text: "MFA enabled for users", satisfaction: "SATISFIED" as const }],
        },
        {
          id: "mission_20250205_120000_multi3",
          service: "s3",
          criteria: [{ text: "Versioning enabled for bucket", satisfaction: "FAILED" as const }],
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

      await iscIndex.build();

      const stats = iscIndex.getStats();
      expect(stats.totalCriteria).toBe(3);
      expect(stats.totalMissions).toBe(3);
    });
  });

  describe("Text Search", () => {
    it("should search criteria by text query", async () => {
      // Create missions with searchable criteria
      const missions = [
        {
          id: "mission_20250205_100000_search1",
          service: "s3",
          criteria: [
            { text: "Public access blocked at bucket level", satisfaction: "SATISFIED" as const },
            { text: "Server-side encryption enabled", satisfaction: "FAILED" as const },
          ],
        },
        {
          id: "mission_20250205_110000_search2",
          service: "cognito",
          criteria: [
            { text: "MFA enabled for all users", satisfaction: "SATISFIED" as const },
            { text: "Public endpoints protected", satisfaction: "PENDING" as const },
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

      await iscIndex.build();

      // Search for "public"
      const publicResults = await iscIndex.search("public");
      expect(publicResults.length).toBe(2);

      // Search for "encryption"
      const encryptionResults = await iscIndex.search("encryption");
      expect(encryptionResults.length).toBe(1);
      expect(encryptionResults[0].text).toContain("encryption");
    });

    it("should support multi-word search queries", async () => {
      const missionId = "mission_20250205_130000_multiword";
      await workManager.createMission({
        missionId,
        target: "test-bucket",
        service: "s3",
        status: "COMPLETED",
        startedAt: new Date().toISOString(),
      });

      await workManager.saveISC(
        missionId,
        createMockISC(missionId, [
          { text: "Public access blocked at bucket level", satisfaction: "SATISFIED" },
          { text: "Private data encrypted at rest", satisfaction: "SATISFIED" },
        ])
      );

      await iscIndex.build();

      // Search for "access blocked" should find the first criterion
      const results = await iscIndex.search("access blocked");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].text).toContain("access");
      expect(results[0].text).toContain("blocked");
    });
  });

  describe("Filtering", () => {
    it("should filter search results by service", async () => {
      // Create S3 and Cognito missions with similar criteria
      const missions = [
        {
          id: "mission_20250205_100000_filter_s3",
          service: "s3",
          criteria: [{ text: "Access control enforced", satisfaction: "SATISFIED" as const }],
        },
        {
          id: "mission_20250205_110000_filter_cog",
          service: "cognito",
          criteria: [{ text: "Access control enforced", satisfaction: "FAILED" as const }],
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

      await iscIndex.build();

      // Filter by S3 service
      const s3Results = await iscIndex.search("access", { service: "s3" });
      expect(s3Results.length).toBe(1);
      expect(s3Results[0].service).toBe("s3");

      // Filter by Cognito service
      const cognitoResults = await iscIndex.search("access", { service: "cognito" });
      expect(cognitoResults.length).toBe(1);
      expect(cognitoResults[0].service).toBe("cognito");
    });

    it("should filter search results by satisfaction status", async () => {
      const missionId = "mission_20250205_140000_status";
      await workManager.createMission({
        missionId,
        target: "test-target",
        service: "s3",
        status: "COMPLETED",
        startedAt: new Date().toISOString(),
      });

      await workManager.saveISC(
        missionId,
        createMockISC(missionId, [
          { text: "First criterion test", satisfaction: "SATISFIED" },
          { text: "Second criterion test", satisfaction: "FAILED" },
          { text: "Third criterion test", satisfaction: "PENDING" },
        ])
      );

      await iscIndex.build();

      // Filter by SATISFIED
      const satisfiedResults = await iscIndex.search("criterion", { status: "SATISFIED" });
      expect(satisfiedResults.length).toBe(1);
      expect(satisfiedResults[0].satisfaction).toBe("SATISFIED");

      // Filter by FAILED
      const failedResults = await iscIndex.search("criterion", { status: "FAILED" });
      expect(failedResults.length).toBe(1);
      expect(failedResults[0].satisfaction).toBe("FAILED");
    });

    it("should filter by date range", async () => {
      // Create missions on different dates
      const missions = [
        { id: "mission_20250201_100000_old", date: "2025-02-01" },
        { id: "mission_20250205_100000_new", date: "2025-02-05" },
      ];

      for (const m of missions) {
        await workManager.createMission({
          missionId: m.id,
          target: "test-target",
          service: "s3",
          status: "COMPLETED",
          startedAt: new Date().toISOString(),
        });
        await workManager.saveISC(
          m.id,
          createMockISC(m.id, [{ text: "Date filter criterion", satisfaction: "SATISFIED" }])
        );
      }

      await iscIndex.build();

      // Filter to only recent date
      const recentResults = await iscIndex.search("criterion", {
        startDate: "2025-02-04",
      });
      expect(recentResults.length).toBe(1);
      expect(recentResults[0].missionId).toContain("20250205");
    });
  });

  describe("Satisfaction Rates", () => {
    it("should calculate overall satisfaction rate across missions", async () => {
      // Create missions with varying satisfaction
      const missions = [
        {
          id: "mission_20250205_100000_rate1",
          criteria: [
            { text: "Criterion A", satisfaction: "SATISFIED" as const },
            { text: "Criterion B", satisfaction: "SATISFIED" as const },
          ],
        },
        {
          id: "mission_20250205_110000_rate2",
          criteria: [
            { text: "Criterion C", satisfaction: "SATISFIED" as const },
            { text: "Criterion D", satisfaction: "FAILED" as const },
          ],
        },
      ];

      for (const m of missions) {
        await workManager.createMission({
          missionId: m.id,
          target: "test-target",
          service: "s3",
          status: "COMPLETED",
          startedAt: new Date().toISOString(),
        });
        await workManager.saveISC(m.id, createMockISC(m.id, m.criteria));
      }

      await iscIndex.build();

      // 3 satisfied out of 4 total = 75%
      const rate = iscIndex.getOverallSatisfactionRate();
      expect(rate).toBe(75);
    });

    it("should calculate satisfaction rate by service", async () => {
      // Create S3 mission (50% satisfaction)
      await workManager.createMission({
        missionId: "mission_20250205_100000_s3rate",
        target: "test-bucket",
        service: "s3",
        status: "COMPLETED",
        startedAt: new Date().toISOString(),
      });
      await workManager.saveISC(
        "mission_20250205_100000_s3rate",
        createMockISC("mission_20250205_100000_s3rate", [
          { text: "S3 criterion 1", satisfaction: "SATISFIED" },
          { text: "S3 criterion 2", satisfaction: "FAILED" },
        ])
      );

      // Create Cognito mission (100% satisfaction)
      await workManager.createMission({
        missionId: "mission_20250205_110000_cograte",
        target: "test-pool",
        service: "cognito",
        status: "COMPLETED",
        startedAt: new Date().toISOString(),
      });
      await workManager.saveISC(
        "mission_20250205_110000_cograte",
        createMockISC("mission_20250205_110000_cograte", [
          { text: "Cognito criterion 1", satisfaction: "SATISFIED" },
        ])
      );

      await iscIndex.build();

      const s3Rate = iscIndex.getSatisfactionRateByService("s3");
      expect(s3Rate).toBe(50);

      const cognitoRate = iscIndex.getSatisfactionRateByService("cognito");
      expect(cognitoRate).toBe(100);
    });
  });

  describe("Index Persistence", () => {
    it("should persist index to LEARNING directory", async () => {
      const missionId = "mission_20250205_150000_persist";
      await workManager.createMission({
        missionId,
        target: "test-target",
        service: "s3",
        status: "COMPLETED",
        startedAt: new Date().toISOString(),
      });

      await workManager.saveISC(
        missionId,
        createMockISC(missionId, [{ text: "Persist test criterion", satisfaction: "SATISFIED" }])
      );

      await iscIndex.build();
      await iscIndex.persist();

      const indexPath = join(TEST_BASE_DIR, "LEARNING", "isc-index.json");
      expect(existsSync(indexPath)).toBe(true);

      const savedIndex = JSON.parse(readFileSync(indexPath, "utf-8"));
      expect(savedIndex.criteria).toBeDefined();
      expect(savedIndex.wordIndex).toBeDefined();
    });

    it("should load index from LEARNING directory", async () => {
      // Create and build index
      const missionId = "mission_20250205_160000_load";
      await workManager.createMission({
        missionId,
        target: "test-target",
        service: "s3",
        status: "COMPLETED",
        startedAt: new Date().toISOString(),
      });

      await workManager.saveISC(
        missionId,
        createMockISC(missionId, [{ text: "Load test criterion", satisfaction: "SATISFIED" }])
      );

      await iscIndex.build();
      await iscIndex.persist();

      // Create new index instance and load
      const newIndex = new ISCIndex(workManager);
      const loaded = await newIndex.load();

      expect(loaded).toBe(true);

      const stats = newIndex.getStats();
      expect(stats.totalCriteria).toBe(1);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty index gracefully", async () => {
      await iscIndex.build();

      const results = await iscIndex.search("anything");
      expect(results.length).toBe(0);

      const rate = iscIndex.getOverallSatisfactionRate();
      expect(rate).toBe(0);
    });

    it("should handle search with no matches", async () => {
      const missionId = "mission_20250205_170000_nomatch";
      await workManager.createMission({
        missionId,
        target: "test-target",
        service: "s3",
        status: "COMPLETED",
        startedAt: new Date().toISOString(),
      });

      await workManager.saveISC(
        missionId,
        createMockISC(missionId, [{ text: "Specific criterion text", satisfaction: "SATISFIED" }])
      );

      await iscIndex.build();

      const results = await iscIndex.search("nonexistent");
      expect(results.length).toBe(0);
    });
  });
});
