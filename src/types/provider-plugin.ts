/**
 * Provider Plugin Interface
 *
 * Enables scaling from 1 provider (AWS Cognito) to 100+ providers
 * by defining a common abstraction for all identity/auth providers.
 *
 * Key Insights from First Principles Analysis:
 * - PLUNDER and CHART are 100% universal (no plugin involvement)
 * - RECON, MARK, RAID, ESCAPE need provider-specific implementations
 * - Plugins PROPOSE evidence, Core WRITES to maintain hash chain
 */

// Re-export types needed by plugins from main implementation
export type {
  Severity,
  EvidenceType,
  Framework,
  TimelineEvent,
  RaidResult,
  DriftFinding,
  Expectation
} from "../corsair-mvp";

// ═══════════════════════════════════════════════════════════════════════════════
// BASE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ObservedState - Base type for all provider snapshots
 *
 * Every provider's snapshot must include:
 * - targetId: Unique identifier for the target (user pool, tenant, org, etc.)
 * - observedAt: ISO timestamp of observation
 * - [key: string]: unknown - Provider-specific fields
 */
export interface ObservedState {
  targetId: string;
  observedAt: string;
  [key: string]: unknown; // Allow provider-specific fields
}

/**
 * AttackVectorDeclaration - Metadata about a supported attack
 *
 * Declares what attacks a plugin can simulate, including:
 * - MITRE ATT&CK mapping for framework translation
 * - Required permissions for authorization validation
 * - Intensity range for calibrated testing
 */
export interface AttackVectorDeclaration {
  vector: string;
  description: string;
  mitreMapping: string; // MITRE ATT&CK technique ID (e.g., "T1556.006")
  requiredPermissions: string[]; // Provider-specific permissions
  intensity: {
    min: number;
    max: number;
    default: number;
  };
}

/**
 * PluginRaidResult - What plugins return from raids
 *
 * Plugins propose evidence but don't write it.
 * Core wraps this in PlunderRecord and writes to hash chain.
 */
export interface PluginRaidResult {
  findings: string[];
  timeline: Array<{ timestamp: string; action: string; result: string }>;
  success: boolean;
  controlsHeld: boolean;
  proposedEvidence?: Record<string, unknown>; // Plugin-specific data for audit
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER PLUGIN INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ProviderPlugin<T> - Core abstraction for all providers
 *
 * Generic parameter T extends ObservedState, allowing each plugin
 * to define its own snapshot structure while maintaining common base.
 *
 * Contract:
 * - recon: Observe target state without modification (read-only)
 * - raid: Execute controlled chaos attack simulation
 * - createCleanup: Return cleanup function scoped to snapshot (RAII pattern)
 * - onLoad/onUnload: Optional lifecycle hooks
 *
 * Plugins implement 4 of 6 primitives:
 * - RECON: Plugin observes provider state → returns T
 * - MARK: Core uses plugin's snapshot + expectations → DriftFinding[]
 * - RAID: Plugin simulates attack → PluginRaidResult
 * - ESCAPE: Plugin creates cleanup function → Core executes via scope guard
 * - PLUNDER: Core handles (100% universal, no plugin code)
 * - CHART: Core handles (100% universal, uses MITRE from AttackVectorDeclaration)
 */
export interface ProviderPlugin<T extends ObservedState> {
  // Plugin identity
  readonly providerId: string; // e.g., "aws-cognito", "okta", "auth0"
  readonly version: string; // Semantic version

  // Attack capabilities
  readonly attackVectors: AttackVectorDeclaration[];

  // RECON primitive: Observe target state
  recon(targetId: string): Promise<T>;

  // RAID primitive: Execute controlled chaos
  raid(snapshot: T, vector: string, intensity: number): Promise<PluginRaidResult>;

  // ESCAPE primitive: Create cleanup function (RAII pattern)
  createCleanup(snapshot: T): () => { operation: string; success: boolean };

  // Lifecycle hooks (optional)
  onLoad?(): Promise<void>;
  onUnload?(): Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLUGIN MANIFEST
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * PluginManifest - Metadata for plugin discovery
 *
 * Each plugin has a `*.plugin.json` file declaring:
 * - Provider identity
 * - Entry point (TypeScript file exporting ProviderPlugin)
 * - Attack vectors supported
 */
export interface PluginManifest {
  providerId: string;
  version: string;
  entryPoint: string; // Relative path to plugin implementation
  attackVectors: AttackVectorDeclaration[];
}
