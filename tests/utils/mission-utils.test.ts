/**
 * Mission Utilities Tests
 *
 * Tests for shared utility functions in mission-utils.ts
 */

import { describe, test, expect } from "bun:test";
import { extractDateFromMissionId } from "../../src/utils/mission-utils";

describe("extractDateFromMissionId", () => {
  test("extracts date from standard mission ID format", () => {
    const missionId = "mission_20260205_143000_abc123";
    const date = extractDateFromMissionId(missionId);
    expect(date).toBe("2026-02-05");
  });

  test("extracts date from mission ID with different prefix", () => {
    const missionId = "security_20250115_093045_xyz789";
    const date = extractDateFromMissionId(missionId);
    expect(date).toBe("2025-01-15");
  });

  test("extracts date from mission ID with edge date values", () => {
    // Test first day of year
    expect(extractDateFromMissionId("mission_20260101_000000_aaa")).toBe("2026-01-01");
    // Test last day of year
    expect(extractDateFromMissionId("mission_20251231_235959_zzz")).toBe("2025-12-31");
  });

  test("returns current date for invalid mission ID format", () => {
    const today = new Date().toISOString().split("T")[0];

    // Missing date pattern
    expect(extractDateFromMissionId("mission_abc123")).toBe(today);

    // Empty string
    expect(extractDateFromMissionId("")).toBe(today);

    // Random string
    expect(extractDateFromMissionId("random-string-without-pattern")).toBe(today);
  });

  test("handles mission ID with multiple underscores", () => {
    const missionId = "my_custom_prefix_20260305_120000_abc";
    const date = extractDateFromMissionId(missionId);
    expect(date).toBe("2026-03-05");
  });
});
