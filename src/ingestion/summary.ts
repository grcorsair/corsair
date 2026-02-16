/**
 * Summary Helpers — Shared Control Metrics
 *
 * Single source of truth for summary statistics derived from controls.
 */

import type { IngestedControl } from "./types";
import type { Severity } from "../types";

export interface ControlSummary {
  controlsTested: number;
  controlsPassed: number;
  controlsFailed: number;
  overallScore: number;
}

export function computeSummaryFromControls(controls: IngestedControl[]): ControlSummary {
  let totalTested = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  for (const ctrl of controls) {
    totalTested++;
    if (ctrl.status === "effective") totalPassed++;
    else if (ctrl.status === "ineffective") totalFailed++;
  }

  const overallScore = totalTested > 0 ? Math.round((totalPassed / totalTested) * 100) : 0;

  return {
    controlsTested: totalTested,
    controlsPassed: totalPassed,
    controlsFailed: totalFailed,
    overallScore,
  };
}

export function computeSeverityDistribution(
  controls: IngestedControl[],
): Record<string, number> | undefined {
  const dist: Record<string, number> = {};
  let hasSeverity = false;

  for (const ctrl of controls) {
    if (ctrl.severity) {
      hasSeverity = true;
      const key = ctrl.severity as Severity;
      dist[key] = (dist[key] || 0) + 1;
    }
  }

  return hasSeverity ? dist : undefined;
}
