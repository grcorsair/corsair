/**
 * CLI ISC Output Test Contract - RED PHASE
 *
 * Tests the ISC summary display in CLI output after mission completion.
 *
 * Contract Requirements:
 * 1. CLI MUST display ISC summary after mission completion
 * 2. CLI MUST show satisfaction rate as percentage
 * 3. CLI MUST show path to ISC.json file
 * 4. CLI MUST show criteria counts (total, satisfied, failed, pending)
 * 5. CLI MUST handle missing ISC.json gracefully
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { ISCManager } from "../../src/core/isc-manager";
import type { ISCState, ISCSatisfaction } from "../../src/types/isc";

/**
 * Format ISC summary for CLI display.
 * This is the function we're testing - it will be integrated into corsair.ts
 */
function formatISCSummary(iscPath: string): string {
  if (!fs.existsSync(iscPath)) {
    return "  No ISC tracking data found";
  }

  try {
    const content = fs.readFileSync(iscPath, "utf-8");
    const state: ISCState = JSON.parse(content);

    const lines: string[] = [];
    lines.push("");
    lines.push("ISC (Ideal State Criteria) Summary");
    lines.push("================================");
    lines.push(`Mission ID: ${state.missionId}`);
    lines.push(`Status: ${state.status}`);
    lines.push("");
    lines.push("Criteria Status:");
    lines.push(`  Total:     ${state.satisfaction.total}`);
    lines.push(`  Satisfied: ${state.satisfaction.satisfied}`);
    lines.push(`  Failed:    ${state.satisfaction.failed}`);
    lines.push(`  Pending:   ${state.satisfaction.pending}`);
    lines.push("");
    lines.push(`Satisfaction Rate: ${state.satisfaction.rate}%`);
    lines.push("");
    lines.push(`ISC File: ${iscPath}`);

    // Add criteria details if verbose
    if (state.criteria.length > 0) {
      lines.push("");
      lines.push("Criteria Details:");
      for (const criterion of state.criteria) {
        const statusIcon = criterion.satisfaction === "SATISFIED" ? "[PASS]" :
                          criterion.satisfaction === "FAILED" ? "[FAIL]" : "[    ]";
        lines.push(`  ${statusIcon} ${criterion.text}`);
      }
    }

    return lines.join("\n");
  } catch (error) {
    return `  Error reading ISC file: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Check if ISC tracking is available for a mission.
 */
function hasISCTracking(missionDir: string): boolean {
  const iscPath = path.join(missionDir, "ISC.json");
  return fs.existsSync(iscPath);
}

describe("CLI ISC Output", () => {
  const testDir = "/tmp/corsair-cli-isc-tests";

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

  // Test 1: CLI displays ISC summary
  test("displays ISC summary with all sections", async () => {
    // Create ISC manager with criteria
    const manager = new ISCManager("mission_cli_001");
    manager.addCriteria([
      "Public access blocked at bucket",
      "Encryption enabled using AES256",
    ]);
    manager.updateSatisfaction(manager.getCriteria()[0].id, "SATISFIED");

    const iscPath = path.join(testDir, "mission_cli_001", "ISC.json");
    await manager.persist(iscPath);

    const summary = formatISCSummary(iscPath);

    // Check all sections are present
    expect(summary).toContain("ISC (Ideal State Criteria) Summary");
    expect(summary).toContain("Mission ID: mission_cli_001");
    expect(summary).toContain("Status:");
    expect(summary).toContain("Criteria Status:");
    expect(summary).toContain("Total:");
    expect(summary).toContain("Satisfied:");
    expect(summary).toContain("Failed:");
    expect(summary).toContain("Pending:");
    expect(summary).toContain("Satisfaction Rate:");
    expect(summary).toContain("ISC File:");
  });

  // Test 2: CLI shows satisfaction rate as percentage
  test("shows satisfaction rate as percentage", async () => {
    const manager = new ISCManager("mission_cli_002");
    manager.addCriteria([
      "Criterion A test here",
      "Criterion B test here",
      "Criterion C test here",
      "Criterion D test here",
    ]);

    // 2 satisfied out of 4 = 50%
    manager.updateSatisfaction(manager.getCriteria()[0].id, "SATISFIED");
    manager.updateSatisfaction(manager.getCriteria()[1].id, "SATISFIED");

    const iscPath = path.join(testDir, "mission_cli_002", "ISC.json");
    await manager.persist(iscPath);

    const summary = formatISCSummary(iscPath);

    expect(summary).toContain("Satisfaction Rate: 50%");
  });

  // Test 3: CLI shows ISC.json path
  test("shows ISC.json file path", async () => {
    const manager = new ISCManager("mission_cli_003");
    manager.addCriterion("Test criterion here");

    const iscPath = path.join(testDir, "mission_cli_003", "ISC.json");
    await manager.persist(iscPath);

    const summary = formatISCSummary(iscPath);

    expect(summary).toContain(`ISC File: ${iscPath}`);
  });

  // Test 4: CLI shows criteria counts
  test("shows criteria counts correctly", async () => {
    const manager = new ISCManager("mission_cli_004");
    manager.addCriteria([
      "Criterion satisfied one here",
      "Criterion satisfied two here",
      "Criterion failed one here",
      "Criterion pending one here",
      "Criterion pending two here",
    ]);

    // Set statuses: 2 satisfied, 1 failed, 2 pending
    const criteria = manager.getCriteria();
    manager.updateSatisfaction(criteria[0].id, "SATISFIED");
    manager.updateSatisfaction(criteria[1].id, "SATISFIED");
    manager.updateSatisfaction(criteria[2].id, "FAILED");
    // criteria[3] and criteria[4] remain PENDING

    const iscPath = path.join(testDir, "mission_cli_004", "ISC.json");
    await manager.persist(iscPath);

    const summary = formatISCSummary(iscPath);

    expect(summary).toContain("Total:     5");
    expect(summary).toContain("Satisfied: 2");
    expect(summary).toContain("Failed:    1");
    expect(summary).toContain("Pending:   2");
  });

  // Test 5: CLI handles missing ISC.json gracefully
  test("handles missing ISC.json gracefully", () => {
    const nonexistentPath = path.join(testDir, "nonexistent", "ISC.json");
    const summary = formatISCSummary(nonexistentPath);

    expect(summary).toContain("No ISC tracking data found");
    expect(summary).not.toContain("Error");
  });

  // Test 6: CLI shows criteria details with status icons
  test("shows criteria details with status icons", async () => {
    const manager = new ISCManager("mission_cli_005");
    manager.addCriteria([
      "Public access blocked completely",
      "Encryption enabled using KMS",
      "Versioning enabled for recovery",
    ]);

    const criteria = manager.getCriteria();
    manager.updateSatisfaction(criteria[0].id, "SATISFIED");
    manager.updateSatisfaction(criteria[1].id, "FAILED");
    // criteria[2] remains PENDING

    const iscPath = path.join(testDir, "mission_cli_005", "ISC.json");
    await manager.persist(iscPath);

    const summary = formatISCSummary(iscPath);

    expect(summary).toContain("Criteria Details:");
    expect(summary).toContain("[PASS] Public access blocked completely");
    expect(summary).toContain("[FAIL] Encryption enabled using KMS");
    expect(summary).toContain("[    ] Versioning enabled for recovery");
  });
});

describe("CLI ISC Output - Helper Functions", () => {
  const testDir = "/tmp/corsair-cli-helpers-tests";

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

  test("hasISCTracking returns true when ISC.json exists", async () => {
    const missionDir = path.join(testDir, "mission_exists");
    fs.mkdirSync(missionDir, { recursive: true });

    const manager = new ISCManager("mission_exists");
    manager.addCriterion("Test criterion here");
    await manager.persist(path.join(missionDir, "ISC.json"));

    expect(hasISCTracking(missionDir)).toBe(true);
  });

  test("hasISCTracking returns false when ISC.json missing", () => {
    const missionDir = path.join(testDir, "mission_missing");
    fs.mkdirSync(missionDir, { recursive: true });

    expect(hasISCTracking(missionDir)).toBe(false);
  });
});
