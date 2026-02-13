/**
 * VC Generator - JWT-VC Generation for Parley
 *
 * Generates W3C Verifiable Credentials encoded as JWT (vc+jwt)
 * from MarqueGeneratorInput. Uses jose library with Ed25519 (EdDSA).
 *
 * The generated JWT contains:
 *   Header: { alg: "EdDSA", typ: "vc+jwt", kid: "did:web:domain#key-1" }
 *   Payload: { iss, sub, exp, iat, jti, vc: {...}, parley: "2.1" }
 *
 * Pipeline: parse → provenance → tool-level assurance → sign.
 * No content-based classification. The tool adapter declares the assurance level.
 */

import * as crypto from "crypto";
import { SignJWT, importPKCS8 } from "jose";
import { existsSync } from "fs";

import { MarqueKeyManager } from "./marque-key-manager";
import { sanitize } from "./marque-generator";
import type { MarqueGeneratorInput } from "./marque-generator";
import type { CPOECredentialSubject, CPOEAssurance, CPOEProvenance } from "./vc-types";
import { VC_CONTEXT, CORSAIR_CONTEXT, CPOE_TYPE } from "./vc-types";
import {
  deriveProvenance,
  deriveEvidenceTypeDistribution,
} from "../ingestion/assurance-calculator";
import { EvidenceEngine } from "../evidence";
import { hashReceipt } from "./process-receipt";
import type { ProcessReceipt } from "./process-receipt";
import { computeRootHash } from "./merkle";

const PRIVATE_KEY_FILENAME = "corsair-signing.key";

/**
 * Generate a JWT-VC from assessment results.
 *
 * Maps MarqueGeneratorInput to a W3C Verifiable Credential,
 * sanitizes sensitive data, and signs with Ed25519 via jose.
 */
export async function generateVCJWT(
  input: MarqueGeneratorInput,
  keyManager: MarqueKeyManager,
  options?: { expiryDays?: number },
): Promise<string> {
  const expiryDays = options?.expiryDays ?? 90;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

  const marqueId = `marque-${crypto.randomUUID()}`;
  const issuerDid = input.issuer.did || input.issuer.id;

  // Build CPOE credential subject
  const rawSubject = buildCredentialSubject(input);
  const sanitizedSubject = sanitize(rawSubject) as CPOECredentialSubject;

  // Build VC payload (without proof — proof is the JWT itself)
  const vc = {
    "@context": [VC_CONTEXT, CORSAIR_CONTEXT],
    type: ["VerifiableCredential", CPOE_TYPE],
    issuer: input.issuer.did
      ? { id: input.issuer.did, name: input.issuer.name }
      : input.issuer.id,
    validFrom: now.toISOString(),
    validUntil: expiresAt.toISOString(),
    credentialSubject: sanitizedSubject,
  };

  // Load private key for jose signing
  const keypair = await keyManager.loadKeypair();
  if (!keypair) {
    throw new Error("No keypair found. Generate a keypair first.");
  }

  const privateKey = await importPKCS8(keypair.privateKey.toString(), "EdDSA");

  // Sign JWT with Ed25519
  const jwt = await new SignJWT({
    vc,
    parley: "2.1",
  })
    .setProtectedHeader({
      alg: "EdDSA",
      typ: "vc+jwt",
      kid: `${issuerDid}#key-1`,
    })
    .setIssuedAt()
    .setIssuer(issuerDid)
    .setSubject(marqueId)
    .setJti(marqueId)
    .setExpirationTime(expiresAt)
    .sign(privateKey);

  return jwt;
}

/**
 * Build CPOE credential subject from assessment input.
 *
 * Provenance-first with tool-level assurance:
 *   - scope, provenance, summary (always)
 *   - assurance from tool-declared level (always)
 *   - frameworks passthrough from tool output (when present)
 *   - processProvenance from receipt chain (when present)
 *   - evidenceChain from JSONL files (when present)
 */
function buildCredentialSubject(input: MarqueGeneratorInput): CPOECredentialSubject {
  // Build frameworks (passthrough from tool output)
  const frameworks: CPOECredentialSubject["frameworks"] = {};
  for (const chart of input.chartResults) {
    if (!chart.frameworks) continue;
    for (const [frameworkName, frameworkData] of Object.entries(chart.frameworks)) {
      if (!frameworks[frameworkName]) {
        frameworks[frameworkName] = { controlsMapped: 0, passed: 0, failed: 0, controls: [] };
      }
      const fw = frameworks[frameworkName];
      for (const ctrl of frameworkData.controls) {
        const status = ctrl.status === "passed" ? "passed" : "failed";
        fw.controls.push({ controlId: ctrl.controlId, status: status as "passed" | "failed" | "not-tested" });
        fw.controlsMapped++;
        if (status === "passed") fw.passed++;
        else fw.failed++;
      }
    }
  }

  // Build summary
  let totalTested = 0, totalPassed = 0, totalFailed = 0;
  for (const fw of Object.values(frameworks)) {
    totalTested += fw.controlsMapped;
    totalPassed += fw.passed;
    totalFailed += fw.failed;
  }
  const overallScore = totalTested > 0 ? Math.round((totalPassed / totalTested) * 100) : 0;

  // Build provenance (always — provenance-first model)
  const provenance = buildProvenance(input);

  // Build scope (now a string)
  const scope = buildScope(input);

  // Build tool-level assurance (always — declared by tool class, not content analysis)
  const assurance = buildToolAssurance(input);

  const subject: CPOECredentialSubject = {
    type: "CorsairCPOE",
    scope,
    assurance,
    provenance,
    summary: {
      controlsTested: totalTested,
      controlsPassed: totalPassed,
      controlsFailed: totalFailed,
      overallScore,
    },
  };

  // Evidence chain — only include if there are evidence paths with data
  const evidencePaths = input.evidencePaths || [];
  if (evidencePaths.length > 0) {
    let hashChainRoot = "none";
    let recordCount = 0;
    let chainVerified = true;
    const engine = new EvidenceEngine();
    for (const evPath of evidencePaths) {
      if (!existsSync(evPath)) continue;
      const verification = engine.verifyEvidenceChain(evPath);
      recordCount += verification.recordCount;
      if (!verification.valid) chainVerified = false;
      if (!hashChainRoot || hashChainRoot === "none") {
        const records = engine.readJSONLFile(evPath);
        if (records.length > 0) hashChainRoot = records[0].hash;
      }
    }
    if (recordCount > 0) {
      subject.evidenceChain = { hashChainRoot, recordCount, chainVerified };
    }
  }

  // Frameworks — only include if non-empty (passthrough from tool output)
  if (Object.keys(frameworks).length > 0) {
    subject.frameworks = frameworks;
  }

  if (input.threatModel) {
    subject.threatModel = {
      methodology: input.threatModel.methodology,
      providersAnalyzed: [input.threatModel.provider],
      totalThreats: input.threatModel.threatCount,
      riskDistribution: { ...input.threatModel.riskDistribution },
    };
  }

  if (input.quartermasterAttestation) {
    subject.quartermasterAttestation = {
      confidenceScore: input.quartermasterAttestation.confidenceScore,
      trustTier: input.quartermasterAttestation.trustTier,
      dimensions: input.quartermasterAttestation.dimensions.map((d) => ({
        dimension: d.dimension,
        score: d.score,
      })),
    };
  }

  // Process provenance (in-toto/SLSA — from pipeline receipt chain)
  const processReceipts = input.processReceipts || [];
  if (processReceipts.length > 0) {
    const reproducible = processReceipts.filter(r => r.predicate.reproducible).length;
    const attested = processReceipts.filter(r => r.predicate.llmAttestation).length;
    const toolAttested = processReceipts.filter(r => r.predicate.toolAttestation).length;
    const leafHashes = processReceipts.map(r => hashReceipt(r));
    const scittIds = processReceipts
      .filter(r => r.scittEntryId)
      .map(r => r.scittEntryId!);

    subject.processProvenance = {
      chainDigest: computeRootHash(leafHashes),
      receiptCount: processReceipts.length,
      chainVerified: true,
      format: "in-toto/v1+cose-sign1",
      reproducibleSteps: reproducible,
      attestedSteps: attested,
      ...(toolAttested > 0 ? { toolAttestedSteps: toolAttested } : {}),
      ...(scittIds.length > 0 ? { scittEntryIds: scittIds } : {}),
    };
  }

  return subject;
}

// =============================================================================
// INTERNAL: TOOL-LEVEL ASSURANCE
// =============================================================================

/** Build CPOEAssurance from tool-declared level (no content analysis) */
function buildToolAssurance(input: MarqueGeneratorInput): CPOEAssurance {
  const level = input.document?.toolAssuranceLevel ?? 0;

  // Method derives from tool class
  const methodMap: Record<number, CPOEAssurance["method"]> = {
    0: "self-assessed",
    1: "automated-config-check",
    2: "automated-config-check",
    3: "continuous-observation",
    4: "third-party-attested",
  };

  // Count all controls at the tool-declared level
  const controlCount = input.document?.controls.length ?? 0;
  const breakdown: Record<string, number> = {};
  if (controlCount > 0) {
    breakdown[String(level)] = controlCount;
  }

  return {
    declared: level,
    verified: true,
    method: methodMap[level] ?? "self-assessed",
    breakdown,
  };
}

// =============================================================================
// INTERNAL: PROVENANCE (delegates to assurance-calculator)
// =============================================================================

/** Build CPOEProvenance from input */
function buildProvenance(input: MarqueGeneratorInput): CPOEProvenance {
  if (input.document) {
    const doc = input.document;
    const provenance = deriveProvenance(doc.source, doc.metadata);

    // Evidence type distribution
    const distribution = deriveEvidenceTypeDistribution(doc.controls, doc.source);
    if (Object.keys(distribution).length > 0) {
      provenance.evidenceTypeDistribution = distribution;
    }

    return provenance;
  }

  // Legacy path
  return {
    source: "tool",
    sourceIdentity: input.issuer.name,
  };
}

// =============================================================================
// INTERNAL: SCOPE
// =============================================================================

/** Build scope string from input */
function buildScope(input: MarqueGeneratorInput): string {
  if (input.document) {
    return input.document.metadata.scope;
  }
  return input.providers.join(", ");
}
