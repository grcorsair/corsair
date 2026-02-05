/**
 * ISC (Ideal State Criteria) Type Definitions
 *
 * These types define the structure for tracking security expectations
 * and their satisfaction status throughout Corsair missions.
 */

/**
 * Satisfaction status for an individual ISC criterion.
 * - PENDING: Not yet evaluated
 * - SATISFIED: Criterion met, security expectation achieved
 * - FAILED: Criterion not met, security gap identified
 */
export type ISCSatisfactionStatus = "PENDING" | "SATISFIED" | "FAILED";

/**
 * Overall status of the ISC tracking for a mission.
 * - PENDING: Mission not yet started or ISC not evaluated
 * - IN_PROGRESS: Mission actively evaluating criteria
 * - COMPLETED: All criteria evaluated, mission finished
 */
export type ISCStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";

/**
 * Individual ISC criterion with tracking metadata.
 *
 * Each criterion represents a specific, binary-testable security expectation
 * (e.g., "Public access blocked at bucket level").
 */
export interface ISCCriterion {
  /** Unique identifier for the criterion (e.g., "ISC-1707123456-abc123") */
  id: string;

  /** The criterion text (max 8 words, binary testable) */
  text: string;

  /** Current satisfaction status */
  satisfaction: ISCSatisfactionStatus;

  /** References to evidence (drift findings, raid results) that verified this criterion */
  evidenceRefs: string[];

  /** ISO-8601 timestamp when criterion was created */
  createdAt: string;

  /** ISO-8601 timestamp when criterion was verified (if verified) */
  verifiedAt?: string;

  /** Confidence score for extracted criteria (0-1) */
  confidence?: number;

  /** Source of the criterion (agent response, manual, etc.) */
  source?: string;
}

/**
 * Aggregate satisfaction statistics for ISC tracking.
 */
export interface ISCSatisfaction {
  /** Number of criteria marked as SATISFIED */
  satisfied: number;

  /** Number of criteria marked as FAILED */
  failed: number;

  /** Number of criteria still PENDING */
  pending: number;

  /** Total number of criteria */
  total: number;

  /** Satisfaction rate as percentage (0-100) */
  rate: number;
}

/**
 * Complete ISC state for persistence.
 *
 * This is the shape of ISC.json files saved to missions/{missionId}/ISC.json
 */
export interface ISCState {
  /** Unique mission identifier */
  missionId: string;

  /** Optional task ID associated with this ISC set */
  taskId?: string;

  /** Overall status of ISC tracking */
  status: ISCStatus;

  /** List of all ISC criteria */
  criteria: ISCCriterion[];

  /** Aggregate satisfaction statistics */
  satisfaction: ISCSatisfaction;

  /** ISO-8601 timestamp when ISC was created */
  createdAt: string;

  /** ISO-8601 timestamp when ISC was last updated */
  updatedAt: string;

  /** Additional metadata (phase, target, etc.) */
  metadata?: Record<string, unknown>;
}

/**
 * Result of ISC extraction from agent response text.
 */
export interface ISCExtractionResult {
  /** Extracted criteria texts */
  criteria: string[];

  /** Confidence score for extraction (0-1) */
  confidence: number;

  /** Whether ISC section was found in text */
  found: boolean;

  /** Raw section text that was parsed */
  rawSection?: string;

  /** Extraction method used */
  method: "json_array" | "numbered_list" | "bullet_list" | "quoted" | "fallback";
}

/**
 * Result of verifying an ISC criterion.
 */
export interface ISCVerificationResult {
  /** Criterion ID that was verified */
  criterionId: string;

  /** Whether verification was successful */
  verified: boolean;

  /** New satisfaction status after verification */
  satisfaction: ISCSatisfactionStatus;

  /** Evidence reference used for verification */
  evidenceRef?: string;

  /** ISO-8601 timestamp of verification */
  verifiedAt: string;
}
