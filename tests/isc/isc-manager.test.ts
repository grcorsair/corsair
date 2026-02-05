/**
 * ISCManager Test Contract - RED PHASE
 *
 * ISCManager tracks Ideal State Criteria (ISC) and their satisfaction status.
 * This enables Corsair to measure progress toward security goals.
 *
 * Contract Requirements:
 * 1. ISCManager MUST be created with a mission ID
 * 2. ISCManager MUST support adding criteria with unique IDs
 * 3. ISCManager MUST support bulk adding multiple criteria
 * 4. ISCManager MUST track satisfaction status (PENDING, SATISFIED, FAILED)
 * 5. ISCManager MUST support verification with evidence linking
 * 6. ISCManager MUST calculate satisfaction rate accurately
 * 7. ISCManager MUST persist state to JSON file
 * 8. ISCManager MUST load state from JSON file
 * 9. ISCManager MUST update overall status and metadata
 * 10. ISCManager MUST avoid duplicate criteria
 * 11. ISCManager MUST auto-timestamp all operations
 * 12. ISCManager MUST generate valid mission IDs
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { ISCManager } from "../../src/core/isc-manager";
import type { ISCCriterion, ISCSatisfaction, ISCState } from "../../src/types/isc";

describe("ISCManager - Ideal State Criteria Tracking", () => {
  const testDir = "/tmp/corsair-isc-tests";
  let manager: ISCManager;

  beforeEach(() => {
    // Clean up test directory before each test
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory after each test
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  // Test 1: ISCManager creation with mission ID
  test("creates ISCManager with mission ID and initial state", () => {
    const missionId = "mission_20260205_abc123";
    manager = new ISCManager(missionId);

    expect(manager.getMissionId()).toBe(missionId);
    expect(manager.getStatus()).toBe("PENDING");
    expect(manager.getCriteria()).toEqual([]);
    expect(manager.getSatisfactionRate()).toBe(0);
  });

  // Test 2: Add criterion with unique ID
  test("adds criterion with unique ID and returns the ID", () => {
    manager = new ISCManager("mission_001");

    const criterionId = manager.addCriterion("Public access blocked at bucket level");

    expect(criterionId).toMatch(/^ISC-\d+-[a-z0-9]+$/);
    expect(manager.getCriteria().length).toBe(1);

    const criterion = manager.getCriterion(criterionId);
    expect(criterion).toBeDefined();
    expect(criterion?.text).toBe("Public access blocked at bucket level");
    expect(criterion?.satisfaction).toBe("PENDING");
    expect(criterion?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  // Test 3: Bulk add multiple criteria
  test("bulk adds multiple criteria and returns IDs", () => {
    manager = new ISCManager("mission_002");

    const criteriaTexts = [
      "Encryption enabled using AES256 algorithm",
      "Versioning enabled for data protection",
      "Server access logging enabled on bucket",
    ];

    const ids = manager.addCriteria(criteriaTexts);

    expect(ids.length).toBe(3);
    expect(manager.getCriteria().length).toBe(3);

    ids.forEach((id, index) => {
      const criterion = manager.getCriterion(id);
      expect(criterion?.text).toBe(criteriaTexts[index]);
    });
  });

  // Test 4: Update satisfaction status
  test("updates satisfaction status for a criterion", () => {
    manager = new ISCManager("mission_003");
    const id = manager.addCriterion("MFA required for all users");

    // Initial state should be PENDING
    expect(manager.getCriterion(id)?.satisfaction).toBe("PENDING");

    // Update to SATISFIED
    manager.updateSatisfaction(id, "SATISFIED");
    expect(manager.getCriterion(id)?.satisfaction).toBe("SATISFIED");

    // Update to FAILED
    manager.updateSatisfaction(id, "FAILED");
    expect(manager.getCriterion(id)?.satisfaction).toBe("FAILED");
  });

  // Test 5: Verify criterion with evidence linking
  test("verifies criterion and links evidence", () => {
    manager = new ISCManager("mission_004");
    const id = manager.addCriterion("Public access blocked at bucket level");

    const evidenceRef = "DRIFT-mfa-001";
    const result = manager.verifyCriterion(id, true, evidenceRef);

    expect(result.verified).toBe(true);
    expect(result.satisfaction).toBe("SATISFIED");

    const criterion = manager.getCriterion(id);
    expect(criterion?.satisfaction).toBe("SATISFIED");
    expect(criterion?.evidenceRefs).toContain(evidenceRef);
    expect(criterion?.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  // Test 6: Verify criterion as failed
  test("verifies criterion as failed with evidence", () => {
    manager = new ISCManager("mission_005");
    const id = manager.addCriterion("Encryption enabled using KMS");

    const evidenceRef = "DRIFT-encryption-001";
    const result = manager.verifyCriterion(id, false, evidenceRef);

    expect(result.verified).toBe(true);
    expect(result.satisfaction).toBe("FAILED");

    const criterion = manager.getCriterion(id);
    expect(criterion?.satisfaction).toBe("FAILED");
    expect(criterion?.evidenceRefs).toContain(evidenceRef);
  });

  // Test 7: Calculate satisfaction rate accurately
  test("calculates satisfaction rate accurately", () => {
    manager = new ISCManager("mission_006");

    // Add 4 criteria
    const ids = manager.addCriteria([
      "Criterion A",
      "Criterion B",
      "Criterion C",
      "Criterion D",
    ]);

    // 0/4 satisfied = 0%
    expect(manager.getSatisfactionRate()).toBe(0);

    // 1/4 satisfied = 25%
    manager.updateSatisfaction(ids[0], "SATISFIED");
    expect(manager.getSatisfactionRate()).toBe(25);

    // 2/4 satisfied = 50%
    manager.updateSatisfaction(ids[1], "SATISFIED");
    expect(manager.getSatisfactionRate()).toBe(50);

    // 3/4 satisfied (1 failed) = 75%
    manager.updateSatisfaction(ids[2], "SATISFIED");
    manager.updateSatisfaction(ids[3], "FAILED");
    expect(manager.getSatisfactionRate()).toBe(75);
  });

  // Test 8: Persist state to JSON file
  test("persists state to JSON file", async () => {
    manager = new ISCManager("mission_007");
    const ids = manager.addCriteria([
      "Public access blocked completely",
      "Encryption enabled with KMS",
    ]);
    manager.updateSatisfaction(ids[0], "SATISFIED");

    const filePath = path.join(testDir, "mission_007", "ISC.json");
    await manager.persist(filePath);

    expect(fs.existsSync(filePath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    expect(content.missionId).toBe("mission_007");
    expect(content.status).toBe("PENDING");
    expect(content.criteria.length).toBe(2);
    expect(content.satisfaction.satisfied).toBe(1);
    expect(content.satisfaction.total).toBe(2);
    expect(content.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(content.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  // Test 9: Load state from JSON file
  test("loads state from JSON file", async () => {
    // First create and persist a manager
    const originalManager = new ISCManager("mission_008");
    const ids = originalManager.addCriteria([
      "Versioning enabled for protection",
      "Logging enabled on bucket",
    ]);
    originalManager.updateSatisfaction(ids[0], "SATISFIED");
    originalManager.updateSatisfaction(ids[1], "FAILED");

    const filePath = path.join(testDir, "mission_008", "ISC.json");
    await originalManager.persist(filePath);

    // Now load from file
    const loadedManager = await ISCManager.load(filePath);

    expect(loadedManager.getMissionId()).toBe("mission_008");
    expect(loadedManager.getCriteria().length).toBe(2);
    expect(loadedManager.getSatisfactionRate()).toBe(50);

    const criterion1 = loadedManager.getCriteria()[0];
    expect(criterion1.text).toBe("Versioning enabled for protection");
    expect(criterion1.satisfaction).toBe("SATISFIED");
  });

  // Test 10: Update overall status and metadata
  test("updates overall status and metadata", () => {
    manager = new ISCManager("mission_009");
    manager.addCriteria(["Test criterion"]);

    // Update status
    manager.updateStatus("IN_PROGRESS");
    expect(manager.getStatus()).toBe("IN_PROGRESS");

    // Update metadata
    manager.updateMetadata({ taskId: "task_001", phase: "RECON" });
    const state = manager.getState();
    expect(state.metadata?.taskId).toBe("task_001");
    expect(state.metadata?.phase).toBe("RECON");

    // Update status to completed
    manager.updateStatus("COMPLETED");
    expect(manager.getStatus()).toBe("COMPLETED");
  });

  // Test 11: Avoid duplicate criteria
  test("avoids adding duplicate criteria", () => {
    manager = new ISCManager("mission_010");

    const id1 = manager.addCriterion("Public access blocked completely");
    const id2 = manager.addCriterion("Public access blocked completely"); // Duplicate
    const id3 = manager.addCriterion("Encryption enabled using KMS"); // Different

    // Should only have 2 criteria (duplicate ignored)
    expect(manager.getCriteria().length).toBe(2);

    // Duplicate should return the same ID
    expect(id2).toBe(id1);

    // Different criterion gets different ID
    expect(id3).not.toBe(id1);
  });

  // Test 12: Auto-timestamp all operations
  test("auto-timestamps all operations", () => {
    manager = new ISCManager("mission_011");

    const id = manager.addCriterion("Test criterion for timestamps");
    const criterion = manager.getCriterion(id);

    // Creation timestamp
    expect(criterion?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

    // Verification timestamp
    manager.verifyCriterion(id, true, "evidence-001");
    const verifiedCriterion = manager.getCriterion(id);
    expect(verifiedCriterion?.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

    // State has timestamps
    const state = manager.getState();
    expect(state.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(state.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe("ISCManager - Mission ID Generation", () => {
  test("generates valid filename-safe mission IDs", () => {
    const id1 = ISCManager.generateMissionId();
    const id2 = ISCManager.generateMissionId();

    // Format: mission_{timestamp}_{random}
    expect(id1).toMatch(/^mission_\d{8}_\d{6}_[a-z0-9]+$/);
    expect(id2).toMatch(/^mission_\d{8}_\d{6}_[a-z0-9]+$/);

    // Should be unique
    expect(id1).not.toBe(id2);

    // Should be filename-safe (no special chars)
    expect(id1).not.toMatch(/[\/\\:*?"<>|]/);
  });

  test("generates mission ID with custom prefix", () => {
    const id = ISCManager.generateMissionId("security");

    expect(id).toMatch(/^security_\d{8}_\d{6}_[a-z0-9]+$/);
  });
});

describe("ISCManager - Edge Cases", () => {
  const testDir = "/tmp/corsair-isc-edge-tests";

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  test("handles empty criteria list gracefully", () => {
    const manager = new ISCManager("mission_empty");

    expect(manager.getCriteria()).toEqual([]);
    expect(manager.getSatisfactionRate()).toBe(0);
    expect(() => manager.getCriterion("nonexistent")).not.toThrow();
    expect(manager.getCriterion("nonexistent")).toBeUndefined();
  });

  test("handles updating nonexistent criterion gracefully", () => {
    const manager = new ISCManager("mission_nonexistent");

    // Should not throw, just log warning or no-op
    expect(() => manager.updateSatisfaction("nonexistent", "SATISFIED")).not.toThrow();
    expect(() => manager.verifyCriterion("nonexistent", true, "evidence")).not.toThrow();
  });

  test("handles loading from nonexistent file gracefully", async () => {
    const nonexistentPath = path.join(testDir, "nonexistent", "ISC.json");

    await expect(ISCManager.load(nonexistentPath)).rejects.toThrow();
  });

  test("preserves all criterion fields through persist/load cycle", async () => {
    const manager = new ISCManager("mission_roundtrip");
    const id = manager.addCriterion("Test criterion with full data");

    manager.verifyCriterion(id, true, "evidence-001");
    manager.verifyCriterion(id, true, "evidence-002"); // Add second evidence

    const filePath = path.join(testDir, "roundtrip", "ISC.json");
    await manager.persist(filePath);

    const loaded = await ISCManager.load(filePath);
    const loadedCriterion = loaded.getCriterion(id);

    expect(loadedCriterion).toBeDefined();
    expect(loadedCriterion?.text).toBe("Test criterion with full data");
    expect(loadedCriterion?.satisfaction).toBe("SATISFIED");
    expect(loadedCriterion?.evidenceRefs).toContain("evidence-001");
    expect(loadedCriterion?.evidenceRefs).toContain("evidence-002");
    expect(loadedCriterion?.verifiedAt).toBeDefined();
    expect(loadedCriterion?.createdAt).toBeDefined();
  });
});
