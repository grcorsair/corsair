/**
 * CorsairClient — SDK entry point
 *
 * Wraps core Corsair functions (sign, verify, score, query, keygen, formats)
 * into a clean API for external developers.
 *
 * All operations delegate to the root package's engines.
 * This class adds no logic — it is a thin, typed facade.
 */

import { createKeyManager } from "../../../src/parley/marque-key-manager";
import type { KeyManager } from "../../../src/parley/marque-key-manager";
import { signEvidence } from "../../../src/sign/sign-core";
import type { EvidenceFormat } from "../../../src/sign/sign-core";
import { MarqueVerifier } from "../../../src/parley/marque-verifier";
import { normalizeDocument } from "../../../src/normalize/normalize";
import { scoreEvidence } from "../../../src/scoring/scoring-engine";
import { queryEvidence } from "../../../src/query/query-engine";
import { parseJSON } from "../../../src/ingestion/json-parser";

import type {
  CorsairClientConfig,
  SignOptions,
  SignResult,
  VerifyResult,
  ScoreResult,
  ScoreInputOptions,
} from "./types";
import type { QueryResult, EvidenceQuery } from "../../../src/query/types";
import type { CanonicalControlEvidence } from "../../../src/normalize/types";

// =============================================================================
// SUPPORTED FORMATS
// =============================================================================

const SUPPORTED_FORMATS: EvidenceFormat[] = [
  "generic",
  "prowler",
  "securityhub",
  "inspec",
  "trivy",
  "gitlab",
  "ciso-assistant-api",
  "ciso-assistant-export",
];

// =============================================================================
// CLIENT
// =============================================================================

export class CorsairClient {
  private readonly keyDir?: string;
  private readonly defaultDid?: string;
  private keyManager: KeyManager;

  constructor(config?: CorsairClientConfig) {
    this.keyDir = config?.keyDir;
    this.defaultDid = config?.did;
    this.keyManager = createKeyManager(this.keyDir);
  }

  // ---------------------------------------------------------------------------
  // KEYGEN
  // ---------------------------------------------------------------------------

  /**
   * Generate an Ed25519 keypair for CPOE signing.
   *
   * @param outputDir - Directory to write keys to (overrides config keyDir)
   * @returns PEM-encoded public and private keys
   */
  async keygen(outputDir?: string): Promise<{ publicKey: string; privateKey: string }> {
    const km = outputDir ? createKeyManager(outputDir) : this.keyManager;

    // If outputDir was provided, use that manager for this call only
    if (outputDir) {
      const result = await km.generateKeypair();
      return {
        publicKey: result.publicKey.toString(),
        privateKey: result.privateKey.toString(),
      };
    }

    // Generate and update internal key manager reference
    const result = await this.keyManager.generateKeypair();
    return {
      publicKey: result.publicKey.toString(),
      privateKey: result.privateKey.toString(),
    };
  }

  // ---------------------------------------------------------------------------
  // SIGN
  // ---------------------------------------------------------------------------

  /**
   * Sign evidence as a CPOE (JWT-VC).
   *
   * @param evidence - Raw JSON object or JSON string
   * @param options - Sign options (format, did, scope, expiryDays, dryRun)
   * @returns SignResult with JWT, summary, provenance, warnings
   */
  async sign(evidence: unknown, options?: SignOptions): Promise<SignResult> {
    const input = typeof evidence === "string" ? evidence : evidence;

    const output = await signEvidence(
      {
        evidence: input as string | object,
        format: options?.format,
        did: options?.did ?? this.defaultDid,
        scope: options?.scope,
        expiryDays: options?.expiryDays,
        dryRun: options?.dryRun,
      },
      this.keyManager,
    );

    return {
      jwt: output.jwt,
      marqueId: output.marqueId,
      detectedFormat: output.detectedFormat,
      summary: output.summary,
      provenance: output.provenance,
      warnings: output.warnings,
    };
  }

  // ---------------------------------------------------------------------------
  // VERIFY
  // ---------------------------------------------------------------------------

  /**
   * Verify a CPOE (JWT-VC) signature and structure.
   *
   * @param cpoe - JWT-VC string
   * @returns VerifyResult with validity, metadata, and trust tier
   */
  async verify(cpoe: string): Promise<VerifyResult> {
    const keypair = await this.keyManager.loadKeypair();
    const publicKeys = keypair ? [keypair.publicKey] : [];

    // Include retired keys for verification
    const retiredKeys = await this.keyManager.getRetiredKeys();
    const allKeys = [...publicKeys, ...retiredKeys];

    const verifier = new MarqueVerifier(allKeys);
    return verifier.verify(cpoe);
  }

  // ---------------------------------------------------------------------------
  // SCORE
  // ---------------------------------------------------------------------------

  /**
   * Score evidence quality across 7 dimensions.
   *
   * Parses the evidence, normalizes to canonical format, then runs
   * the scoring engine. Returns a composite 0-100 score and letter grade.
   *
   * @param evidence - Raw JSON object or JSON string
   * @param options - Format override and process provenance flag
   * @returns ScoreResult with composite score, grade, and per-dimension breakdown
   */
  async score(evidence: unknown, options?: ScoreInputOptions): Promise<ScoreResult> {
    const controls = this.normalizeEvidence(evidence, options?.format);
    return scoreEvidence(controls, {
      hasProcessProvenance: options?.hasProcessProvenance,
    });
  }

  // ---------------------------------------------------------------------------
  // QUERY
  // ---------------------------------------------------------------------------

  /**
   * Query and filter normalized evidence controls.
   *
   * @param evidence - Raw JSON object or JSON string
   * @param query - Filter, sort, and pagination options
   * @param format - Optional format override for parsing
   * @returns QueryResult with matched controls, total, and aggregations
   */
  async query(
    evidence: unknown,
    query?: EvidenceQuery,
    format?: EvidenceFormat,
  ): Promise<QueryResult> {
    const controls = this.normalizeEvidence(evidence, format);
    return queryEvidence(controls, query ?? {});
  }

  // ---------------------------------------------------------------------------
  // FORMATS
  // ---------------------------------------------------------------------------

  /**
   * Return the list of supported evidence formats.
   */
  formats(): string[] {
    return [...SUPPORTED_FORMATS];
  }

  // ---------------------------------------------------------------------------
  // INTERNAL
  // ---------------------------------------------------------------------------

  /**
   * Parse raw evidence and normalize it to canonical format.
   * Shared by score() and query() to avoid duplicate parsing.
   */
  private normalizeEvidence(
    evidence: unknown,
    format?: EvidenceFormat,
  ): CanonicalControlEvidence[] {
    const doc = parseJSON(evidence as string | object, {
      source: undefined,
      format,
    });

    const normalized = normalizeDocument(doc);
    return normalized.controls;
  }
}
