/**
 * VC Generator - JWT-VC Generation for Parley
 *
 * Generates W3C Verifiable Credentials encoded as JWT (vc+jwt)
 * from MarqueGeneratorInput. Uses jose library with Ed25519 (EdDSA).
 *
 * The generated JWT contains:
 *   Header: { alg: "EdDSA", typ: "vc+jwt", kid: "did:web:domain#key-1" }
 *   Payload: { iss, sub, exp, iat, jti, vc: {...}, parley: "2.0" }
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
  calculateDocumentAssurance,
  calculateDocumentRollup,
  deriveProvenance,
  calculateAssuranceDimensions,
  deriveEvidenceTypes,
  deriveObservationPeriod,
  generateRuleTrace,
  applyAntiGamingSafeguards,
  deriveEvidenceTypeDistribution,
} from "../ingestion/assurance-calculator";
import { EvidenceEngine } from "../evidence";

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
  const expiryDays = options?.expiryDays ?? 7;
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
 */
function buildCredentialSubject(input: MarqueGeneratorInput): CPOECredentialSubject {
  // Build frameworks
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

  // Build assurance
  const assurance = buildAssurance(input);

  // Build provenance
  const provenance = buildProvenance(input);

  // Build scope (now a string)
  const scope = buildScope(input);

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

  // Frameworks — only include if non-empty
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

  // Wire in framework-grounded assurance dimensions (optional, informational)
  if (input.document) {
    const doc = input.document;

    // Extract QM scores for dimension calculation if available
    const qmScores = input.quartermasterAttestation
      ? {
          methodology: input.quartermasterAttestation.dimensions.find(d => d.dimension === "methodology")?.score ?? undefined,
          bias: input.quartermasterAttestation.dimensions.find(d => d.dimension === "bias_detection" || d.dimension === "bias")?.score ?? undefined,
        }
      : undefined;

    // Only include if QM scores are valid (both defined) or neither
    const cleanQmScores = qmScores && (qmScores.methodology !== undefined || qmScores.bias !== undefined)
      ? qmScores as { methodology: number; bias: number }
      : undefined;

    subject.dimensions = calculateAssuranceDimensions(
      doc.controls,
      doc.source,
      doc.metadata,
      cleanQmScores,
    );

    const evidenceTypes = deriveEvidenceTypes(doc.controls, doc.source);
    if (evidenceTypes.length > 0) {
      subject.evidenceTypes = evidenceTypes;
    }

    const observationPeriod = deriveObservationPeriod(doc.metadata);
    if (observationPeriod) {
      subject.observationPeriod = observationPeriod;
    }
  }

  return subject;
}

// =============================================================================
// INTERNAL: ASSURANCE (delegates to assurance-calculator)
// =============================================================================

/** Build CPOEAssurance from input */
function buildAssurance(input: MarqueGeneratorInput): CPOEAssurance {
  if (input.document) {
    const doc = input.document;
    const controlsWithAssurance = calculateDocumentAssurance(
      doc.controls,
      doc.source,
      doc.metadata,
    );
    const { assurance } = calculateDocumentRollup(controlsWithAssurance, doc.source, doc.metadata);

    // Deterministic calculation metadata (Task #12)
    assurance.calculationVersion = "l0-l4@2026-02-09";
    assurance.ruleTrace = generateRuleTrace(controlsWithAssurance, doc.source, doc.metadata);

    // Anti-gaming safeguards (Task #11) — informational, not overriding declared
    const safeguardResult = applyAntiGamingSafeguards(
      assurance.declared,
      doc.controls,
      doc.source,
      doc.metadata,
    );
    if (safeguardResult.appliedSafeguards.length > 0) {
      assurance.ruleTrace.push(
        ...safeguardResult.explanations.map(e => `SAFEGUARD: ${e}`),
      );
    }

    return assurance;
  }

  // Legacy path — no document, minimal assurance
  return {
    declared: 0,
    verified: false,
    method: "self-assessed",
    breakdown: {},
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

    // Evidence type distribution (Task #14)
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
