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
  classifyEvidenceContent,
  extractSampleSize,
  detectBoilerplate,
  classifyAssessmentDepth,
  computeProvenanceQuality,
  runBinaryChecks,
  computeDoraMetrics,
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
  options?: { expiryDays?: number; enrich?: boolean },
): Promise<string> {
  const expiryDays = options?.expiryDays ?? 7;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

  const marqueId = `marque-${crypto.randomUUID()}`;
  const issuerDid = input.issuer.did || input.issuer.id;

  // Build CPOE credential subject
  const enrich = options?.enrich ?? false;
  const rawSubject = buildCredentialSubject(input, enrich);
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
 * Default (enrich=false): provenance-first — scope, provenance, summary only.
 * Enriched (enrich=true): adds assurance, dimensions, evidenceTypes,
 * observationPeriod, controlClassifications, assessmentDepth, provenanceQuality, doraMetrics.
 */
function buildCredentialSubject(input: MarqueGeneratorInput, enrich: boolean = false): CPOECredentialSubject {
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

  // Build provenance (always — provenance-first model)
  const provenance = buildProvenance(input);

  // Build scope (now a string)
  const scope = buildScope(input);

  const subject: CPOECredentialSubject = {
    type: "CorsairCPOE",
    scope,
    provenance,
    summary: {
      controlsTested: totalTested,
      controlsPassed: totalPassed,
      controlsFailed: totalFailed,
      overallScore,
    },
  };

  // Build assurance only when enrichment is requested
  if (enrich) {
    subject.assurance = buildAssurance(input);
  }

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

  // Wire in framework-grounded assurance dimensions (only when enrichment is requested)
  if (enrich && input.document) {
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
      doc.assessmentContext,
    );

    const evidenceTypes = deriveEvidenceTypes(doc.controls, doc.source);
    if (evidenceTypes.length > 0) {
      subject.evidenceTypes = evidenceTypes;
    }

    const observationPeriod = deriveObservationPeriod(doc.metadata);
    if (observationPeriod) {
      subject.observationPeriod = observationPeriod;
    }

    // Phase 1: Per-control evidence classification with sample adequacy + boilerplate detection
    const boilerplateResults = detectBoilerplate(doc.controls);
    const boilerplateMap = new Map(boilerplateResults.map(b => [b.controlId, b]));

    const classifications: CPOECredentialSubject["controlClassifications"] = doc.controls.map(ctrl => {
      const classification = classifyEvidenceContent(ctrl, doc.source);
      const bp = boilerplateMap.get(ctrl.id);
      const sampleResult = ctrl.evidence ? extractSampleSize(ctrl.evidence) : null;

      const entry: NonNullable<CPOECredentialSubject["controlClassifications"]>[number] = {
        controlId: ctrl.id,
        level: classification.maxLevel,
        methodology: classification.methodology,
        trace: classification.trace,
      };

      if (sampleResult && sampleResult.sample !== null) {
        entry.sampleAdequacy = {
          sample: sampleResult.sample,
          population: sampleResult.population ?? undefined,
          frequency: sampleResult.frequency ?? undefined,
          adequate: sampleResult.adequate ?? false,
        };
      }

      if (bp && bp.flags.length > 0) {
        entry.boilerplateFlags = bp.flags;
      }

      return entry;
    });

    if (classifications.length > 0) {
      subject.controlClassifications = classifications;
    }

    // Phase 6A: NIST 800-53A assessment depth (aggregate across controls)
    const depths = doc.controls.map(ctrl => classifyAssessmentDepth(ctrl));
    const allMethods = new Set<"examine" | "interview" | "test">();
    let maxRigor = 0;
    let maxDepth: "basic" | "focused" | "comprehensive" = "basic";
    for (const d of depths) {
      for (const m of d.methods) allMethods.add(m);
      if (d.rigorScore > maxRigor) {
        maxRigor = d.rigorScore;
        maxDepth = d.depth;
      }
    }
    if (allMethods.size > 0) {
      subject.assessmentDepth = {
        methods: [...allMethods],
        depth: maxDepth,
        rigorScore: maxRigor,
      };
    }

    // Phase 6B: SLSA-inspired provenance quality
    subject.provenanceQuality = computeProvenanceQuality(doc.controls, doc.source, doc.metadata);

    // Phase 6D: DORA paired metrics (needs dimensions)
    if (subject.dimensions) {
      subject.doraMetrics = computeDoraMetrics(doc.controls, doc.source, doc.metadata, subject.dimensions);
    }
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

    // Anti-gaming safeguards (Phase 3) — ENFORCED: cap declared level when triggered
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

      // Phase 3: Enforce safeguards — cap declared level when effective level is lower
      if (safeguardResult.effectiveLevel < assurance.declared) {
        assurance.ruleTrace.push(
          `ENFORCED: declared L${assurance.declared} → L${safeguardResult.effectiveLevel} (safeguard cap)`
        );
        assurance.declared = safeguardResult.effectiveLevel;
        assurance.verified = false;
      }
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
