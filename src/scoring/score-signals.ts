/**
 * Score Signals — FLAGSHIP event generation from score changes
 *
 * Completes the Normalize -> Classify -> Score -> Query -> Signal pipeline.
 * When evidence is scored, compares against previous scores and emits
 * FLAGSHIP events for significant changes (COLORS_CHANGED).
 *
 * Threshold: 5 points default, grade changes always signal (configurable).
 */

import type { CanonicalControlEvidence } from "../normalize/types";
import type {
  FlagshipEvent,
  ColorsChangedData,
} from "../flagship/flagship-types";
import { FLAGSHIP_EVENTS } from "../flagship/flagship-types";
import type { EvidenceQualityScore } from "./types";
import { scoreEvidence } from "./scoring-engine";

// =============================================================================
// TYPES
// =============================================================================

/** Per-dimension change tracking */
export interface DimensionChange {
  /** Dimension name */
  name: string;

  /** Previous score */
  previousScore: number;

  /** Current score */
  currentScore: number;

  /** Score delta (current - previous) */
  delta: number;

  /** Direction of change */
  direction: "improved" | "degraded" | "stable";
}

/** Result of comparing two scores */
export interface ScoreChangeEvent {
  /** Previous score summary (null if first scoring) */
  previous: { composite: number; grade: string } | null;

  /** Current score summary */
  current: { composite: number; grade: string };

  /** Composite score delta (current - previous, or current if first) */
  delta: number;

  /** Whether the letter grade changed */
  gradeChanged: boolean;

  /** Overall direction */
  direction: "improved" | "degraded" | "stable";

  /** Per-dimension changes (null if no previous score) */
  dimensionChanges: DimensionChange[] | null;
}

/** Configuration for signal emission thresholds */
export interface ScoreSignalConfig {
  /** Minimum absolute delta to trigger a signal (default: 5) */
  threshold?: number;

  /** Always signal on grade changes regardless of threshold (default: true) */
  signalOnGradeChange?: boolean;
}

/** Result of the full score-and-signal pipeline */
export interface ScoreAndSignalResult {
  /** The computed evidence quality score */
  score: EvidenceQualityScore;

  /** The FLAGSHIP event to emit (null if no signal needed) */
  event: FlagshipEvent | null;

  /** The score change details */
  change: ScoreChangeEvent;
}

// =============================================================================
// SCORE COMPARISON
// =============================================================================

/**
 * Compare current score against a previous score (or null for first scoring).
 *
 * Returns a ScoreChangeEvent with delta, grade change detection,
 * direction, and per-dimension breakdown.
 */
export function compareScores(
  current: EvidenceQualityScore,
  previous: EvidenceQualityScore | null,
): ScoreChangeEvent {
  if (previous === null) {
    return {
      previous: null,
      current: { composite: current.composite, grade: current.grade },
      delta: current.composite,
      gradeChanged: true,
      direction: "improved",
      dimensionChanges: null,
    };
  }

  const delta = round(current.composite - previous.composite);
  const gradeChanged = current.grade !== previous.grade;

  let direction: "improved" | "degraded" | "stable";
  if (delta > 0) {
    direction = "improved";
  } else if (delta < 0) {
    direction = "degraded";
  } else {
    direction = "stable";
  }

  // Build per-dimension changes
  const dimensionChanges: DimensionChange[] = current.dimensions.map(
    (currentDim) => {
      const previousDim = previous.dimensions.find(
        (d) => d.name === currentDim.name,
      );
      const prevScore = previousDim?.score ?? 0;
      const dimDelta = round(currentDim.score - prevScore);

      let dimDirection: "improved" | "degraded" | "stable";
      if (dimDelta > 0) {
        dimDirection = "improved";
      } else if (dimDelta < 0) {
        dimDirection = "degraded";
      } else {
        dimDirection = "stable";
      }

      return {
        name: currentDim.name,
        previousScore: prevScore,
        currentScore: currentDim.score,
        delta: dimDelta,
        direction: dimDirection,
      };
    },
  );

  return {
    previous: { composite: previous.composite, grade: previous.grade },
    current: { composite: current.composite, grade: current.grade },
    delta,
    gradeChanged,
    direction,
    dimensionChanges,
  };
}

// =============================================================================
// FLAGSHIP EVENT GENERATION
// =============================================================================

const DEFAULT_THRESHOLD = 5;

/**
 * Generate a FLAGSHIP event from a score change.
 *
 * Returns null if the change doesn't meet the signal threshold.
 * Maps to COLORS_CHANGED event type (assurance level change).
 */
export function scoreToFlagshipEvent(
  change: ScoreChangeEvent,
  marqueId: string,
  config?: ScoreSignalConfig,
): FlagshipEvent | null {
  const threshold = config?.threshold ?? DEFAULT_THRESHOLD;
  const signalOnGradeChange = config?.signalOnGradeChange ?? true;

  const absDelta = Math.abs(change.delta);

  // Check if this change warrants a signal
  const meetsThreshold = absDelta >= threshold && change.delta !== 0;
  const meetsGradeChange = signalOnGradeChange && change.gradeChanged;

  if (!meetsThreshold && !meetsGradeChange) {
    return null;
  }

  // Map direction to CAEP change_direction
  const changeDirection: "increase" | "decrease" =
    change.direction === "degraded" ? "decrease" : "increase";

  const data: ColorsChangedData = {
    subject: {
      format: "complex",
      corsair: {
        marqueId,
      },
    },
    event_timestamp: Math.floor(Date.now() / 1000),
    previous_level: change.previous?.grade ?? "none",
    current_level: change.current.grade,
    change_direction: changeDirection,
  };

  return {
    type: FLAGSHIP_EVENTS.COLORS_CHANGED,
    data,
  };
}

// =============================================================================
// PIPELINE INTEGRATION
// =============================================================================

/**
 * One-call convenience: score evidence, compare with previous, generate signal.
 *
 * Completes the full Normalize -> Classify -> Score -> Query -> Signal pipeline.
 */
export function scoreAndSignal(
  controls: CanonicalControlEvidence[],
  previousScore: EvidenceQualityScore | null,
  config?: ScoreSignalConfig,
): ScoreAndSignalResult {
  const score = scoreEvidence(controls);
  const change = compareScores(score, previousScore);
  const event = scoreToFlagshipEvent(change, `marque-${score.scoredAt}`, config);

  return { score, event, change };
}

// =============================================================================
// HELPERS
// =============================================================================

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
