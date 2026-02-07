/**
 * MARQUE Generator - Corsair Proof of Operational Effectiveness
 *
 * Generates cryptographically signed MARQUE documents from Corsair assessment
 * results. Sanitizes all sensitive information (ARNs, IPs, file paths,
 * account IDs, API keys) before embedding into the MARQUE.
 *
 * Uses Ed25519 via MarqueKeyManager for document signing.
 */

import * as crypto from "crypto";
import { readFileSync, existsSync } from "fs";

import { MarqueKeyManager } from "./marque-key-manager";
import type {
  MarqueDocument,
  MarqueEvidenceChain,
  MarqueFrameworkResult,
  MARQUEControlResult,
  MarqueThreatModelSummary,
  MarqueQuartermasterAttestation,
  MarqueIssuer,
  MarqueOutput,
} from "./marque-types";
import type {
  MarkResult,
  RaidResult,
  ChartResult,
  ThreatModelResult,
  PlunderRecord,
} from "../types";
import { EvidenceEngine } from "../evidence";

// =============================================================================
// INPUT TYPE
// =============================================================================

export interface MarqueGeneratorInput {
  markResults: MarkResult[];
  raidResults: RaidResult[];
  chartResults: ChartResult[];
  evidencePaths: string[];
  threatModel?: ThreatModelResult;
  quartermasterAttestation?: MarqueQuartermasterAttestation;
  issuer: MarqueIssuer;
  providers: string[];
}

// =============================================================================
// SANITIZATION PATTERNS
// =============================================================================

/** AWS ARN pattern: arn:aws:service:region:account-id:resource */
const ARN_PATTERN = /arn:aws:[a-zA-Z0-9\-]+:[a-zA-Z0-9\-]*:\d{12}:[^\s,"}\]]+/g;

/** AWS Account ID: exactly 12 digits (only match in string contexts) */
const ACCOUNT_ID_PATTERN = /\b\d{12}\b/g;

/** IPv4 address pattern */
const IPV4_PATTERN = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;

/** Unix/macOS file paths */
const UNIX_PATH_PATTERN = /\/Users\/[^\s,"}\]]+|\/home\/[^\s,"}\]]+/g;

/** Windows file paths */
const WINDOWS_PATH_PATTERN = /C:\\[^\s,"}\]]+/g;

/** AWS access key IDs (AKIA...) */
const AWS_KEY_PATTERN = /AKIA[A-Z0-9]{16}/g;

/** Generic secret/API key patterns */
const SECRET_KEY_PATTERN = /sk-[a-zA-Z0-9\-_]+/g;

/** Cognito user pool ID format: region_identifier */
const COGNITO_POOL_PATTERN = /\b(us|eu|ap|sa|ca|me|af)-[a-z]+-\d+_[A-Za-z0-9]+\b/g;

/** S3 bucket-like identifiers (lowercase with hyphens, at least 3 chars) */
// Note: we handle bucket names via target sanitization rather than broad regex

// =============================================================================
// GENERATOR
// =============================================================================

export class MarqueGenerator {
  private keyManager: MarqueKeyManager;
  private expiryDays: number;
  private format: "v1" | "vc";

  constructor(keyManager: MarqueKeyManager, options?: { expiryDays?: number; format?: "v1" | "vc" }) {
    this.keyManager = keyManager;
    this.expiryDays = options?.expiryDays ?? 7;
    this.format = options?.format ?? "v1";
  }

  /**
   * Generate a complete, signed MARQUE document from assessment results.
   */
  async generate(input: MarqueGeneratorInput): Promise<MarqueDocument> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.expiryDays * 24 * 60 * 60 * 1000);

    // Build all sections with sanitization
    const frameworks = this.buildFrameworks(input.chartResults);
    const summary = this.buildSummary(frameworks);
    const evidenceChain = this.buildEvidenceChain(input.evidencePaths);
    const scope = this.buildScope(input.providers, input.chartResults, input.markResults);
    const threatModel = this.buildThreatModelSummary(input.raidResults, input.threatModel);

    // Build the marque payload
    const marque: MarqueDocument["marque"] = {
      id: `marque-${crypto.randomUUID()}`,
      version: "1.0.0",
      issuer: input.issuer,
      generatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      scope,
      summary,
      evidenceChain,
      frameworks,
    };

    if (threatModel) {
      marque.threatModel = threatModel;
    }

    if (input.quartermasterAttestation) {
      marque.quartermasterAttestation = input.quartermasterAttestation;
    }

    // Sanitize the entire marque payload as a safety net
    const sanitizedCpoe = this.sanitize(marque) as MarqueDocument["marque"];

    // Canonicalize and sign the sanitized payload
    const canonical = this.canonicalize(sanitizedCpoe);
    const signature = this.keyManager.sign(canonical);

    return {
      parley: "1.0",
      marque: sanitizedCpoe,
      signature,
    };
  }

  /**
   * Generate a MarqueOutput in either JWT-VC or JSON envelope format.
   * Uses the format set in constructor options.
   */
  async generateOutput(input: MarqueGeneratorInput): Promise<MarqueOutput> {
    if (this.format === "vc") {
      const { generateVCJWT } = await import("./vc-generator");
      const jwt = await generateVCJWT(input, this.keyManager, { expiryDays: this.expiryDays });

      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.expiryDays * 24 * 60 * 60 * 1000);

      return {
        format: "vc",
        jwt,
        marqueId: `marque-${crypto.randomUUID()}`,
        issuedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };
    }

    // JSON envelope path
    const doc = await this.generate(input);
    return {
      format: "v1",
      v1: doc,
      marqueId: doc.marque.id,
      issuedAt: doc.marque.generatedAt,
      expiresAt: doc.marque.expiresAt,
    };
  }

  // ===========================================================================
  // INTERNAL: BUILDING SECTIONS
  // ===========================================================================

  /**
   * Build per-framework compliance results from ChartResult data.
   * Extracts from the `frameworks` field of each ChartResult.
   */
  private buildFrameworks(chartResults: ChartResult[]): Record<string, MarqueFrameworkResult> {
    const result: Record<string, MarqueFrameworkResult> = {};

    for (const chart of chartResults) {
      if (!chart.frameworks) continue;

      for (const [frameworkName, frameworkData] of Object.entries(chart.frameworks)) {
        if (!result[frameworkName]) {
          result[frameworkName] = {
            controlsMapped: 0,
            passed: 0,
            failed: 0,
            controls: [],
          };
        }

        const fw = result[frameworkName];

        for (const ctrl of frameworkData.controls) {
          const status = ctrl.status === "passed" ? "passed" : "failed";
          fw.controls.push({
            controlId: ctrl.controlId,
            status: status as "passed" | "failed" | "not-tested",
          });
          fw.controlsMapped++;
          if (status === "passed") {
            fw.passed++;
          } else {
            fw.failed++;
          }
        }
      }
    }

    return result;
  }

  /**
   * Compute summary from framework results.
   */
  private buildSummary(frameworks: Record<string, MarqueFrameworkResult>): {
    controlsTested: number;
    controlsPassed: number;
    controlsFailed: number;
    overallScore: number;
  } {
    let totalTested = 0;
    let totalPassed = 0;
    let totalFailed = 0;

    for (const fw of Object.values(frameworks)) {
      totalTested += fw.controlsMapped;
      totalPassed += fw.passed;
      totalFailed += fw.failed;
    }

    const overallScore = totalTested > 0 ? Math.round((totalPassed / totalTested) * 100) : 0;

    return {
      controlsTested: totalTested,
      controlsPassed: totalPassed,
      controlsFailed: totalFailed,
      overallScore,
    };
  }

  /**
   * Build evidence chain metadata from evidence files.
   * Reads the first record hash as the chain root.
   */
  private buildEvidenceChain(evidencePaths: string[]): MarqueEvidenceChain {
    let totalRecords = 0;
    let hashChainRoot = "";
    let allVerified = true;

    const engine = new EvidenceEngine();

    for (const evPath of evidencePaths) {
      if (!existsSync(evPath)) continue;

      const verification = engine.verifyEvidenceChain(evPath);
      totalRecords += verification.recordCount;

      if (!verification.valid) {
        allVerified = false;
      }

      // Use first record's hash as chain root
      if (!hashChainRoot) {
        const records = engine.readJSONLFile(evPath);
        if (records.length > 0) {
          hashChainRoot = records[0].hash;
        }
      }
    }

    return {
      hashChainRoot: hashChainRoot || "none",
      recordCount: totalRecords,
      chainVerified: allVerified,
    };
  }

  /**
   * Build scope from providers and chart results.
   */
  private buildScope(
    providers: string[],
    chartResults: ChartResult[],
    markResults: MarkResult[],
  ): {
    providers: string[];
    resourceCount: number;
    frameworksCovered: string[];
  } {
    const frameworkSet = new Set<string>();

    for (const chart of chartResults) {
      if (chart.frameworks) {
        for (const fw of Object.keys(chart.frameworks)) {
          frameworkSet.add(fw);
        }
      }
    }

    // Resource count: number of unique findings (drift detections)
    let resourceCount = 0;
    for (const mark of markResults) {
      resourceCount += mark.findings.length;
    }
    // Ensure at least 1 resource per provider
    if (resourceCount === 0) {
      resourceCount = providers.length;
    }

    return {
      providers,
      resourceCount,
      frameworksCovered: Array.from(frameworkSet),
    };
  }

  /**
   * Build threat model summary from raid results and optional threat model input.
   */
  private buildThreatModelSummary(
    raidResults: RaidResult[],
    threatModel?: ThreatModelResult,
  ): MarqueThreatModelSummary | undefined {
    if (!threatModel) return undefined;

    return {
      methodology: threatModel.methodology === "STRIDE-automated" ? "STRIDE-automated" : threatModel.methodology,
      providersAnalyzed: [threatModel.provider],
      totalThreats: threatModel.threatCount,
      riskDistribution: { ...threatModel.riskDistribution },
    };
  }

  // ===========================================================================
  // INTERNAL: CANONICALIZATION
  // ===========================================================================

  /**
   * Canonicalize a MARQUE payload for signing.
   * Recursively sorts all object keys for deterministic JSON output.
   */
  private canonicalize(marque: MarqueDocument["marque"]): string {
    return JSON.stringify(sortKeysDeep(marque));
  }

  // ===========================================================================
  // INTERNAL: SANITIZATION (delegates to exported sanitize function)
  // ===========================================================================

  private sanitize(data: unknown): unknown {
    return sanitize(data);
  }
}

// =============================================================================
// SANITIZATION (exported for reuse by vc-generator)
// =============================================================================

/**
 * Deep recursive sanitization of any data structure.
 * Strips ARNs, IP addresses, file paths, account IDs, API keys, etc.
 */
export function sanitize(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "string") {
    return sanitizeString(data);
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitize(item));
  }

  if (typeof data === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      result[key] = sanitize(value);
    }
    return result;
  }

  return data;
}

/**
 * Sanitize a single string value.
 * Replaces sensitive patterns with redacted/hashed placeholders.
 */
function sanitizeString(value: string): string {
  let sanitized = value;

  // Replace ARNs first (most specific pattern)
  sanitized = sanitized.replace(ARN_PATTERN, "[REDACTED-ARN]");

  // Replace Cognito pool IDs
  sanitized = sanitized.replace(COGNITO_POOL_PATTERN, "[REDACTED-POOL]");

  // Replace AWS access keys
  sanitized = sanitized.replace(AWS_KEY_PATTERN, "[REDACTED-KEY]");

  // Replace secret/API keys
  sanitized = sanitized.replace(SECRET_KEY_PATTERN, "[REDACTED-SECRET]");

  // Replace IP addresses
  sanitized = sanitized.replace(IPV4_PATTERN, "[REDACTED-IP]");

  // Replace Unix paths
  sanitized = sanitized.replace(UNIX_PATH_PATTERN, "[REDACTED-PATH]");

  // Replace Windows paths
  sanitized = sanitized.replace(WINDOWS_PATH_PATTERN, "[REDACTED-PATH]");

  // Replace 12-digit account IDs
  sanitized = sanitized.replace(ACCOUNT_ID_PATTERN, "[REDACTED-ACCOUNT]");

  return sanitized;
}

// =============================================================================
// SHARED UTILITY
// =============================================================================

/**
 * Recursively sort all object keys for deterministic serialization.
 * Arrays preserve order; objects get sorted keys.
 */
export function sortKeysDeep(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}
