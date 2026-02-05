/**
 * Mission Utilities
 *
 * Shared utility functions for mission ID handling across Corsair components.
 */

/**
 * Extract date from mission ID.
 *
 * Mission ID format: {prefix}_{YYYYMMDD}_{HHMMSS}_{random}
 * Example: mission_20260205_143000_abc123 -> 2026-02-05
 *
 * @param missionId - The mission ID to parse
 * @returns Date string in YYYY-MM-DD format, or current date if pattern doesn't match
 */
export function extractDateFromMissionId(missionId: string): string {
  const match = missionId.match(/_(\d{4})(\d{2})(\d{2})_/);
  if (match) {
    const [, year, month, day] = match;
    return `${year}-${month}-${day}`;
  }
  // Fallback to current date if pattern doesn't match
  return new Date().toISOString().split("T")[0];
}
