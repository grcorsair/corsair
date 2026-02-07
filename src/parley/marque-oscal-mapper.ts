/**
 * MARQUE to OSCAL Mapper
 *
 * Converts a MarqueDocument into an OSCALAssessmentResult, allowing
 * MARQUE data to be consumed by OSCAL-compatible tools and auditors.
 *
 * Mapping:
 *   - MARQUE frameworks → OSCAL reviewed-controls / control-selections
 *   - MARQUE evidence chain → OSCAL observations
 *   - MARQUE summary → OSCAL result metadata
 */

import type { MarqueDocument } from "./marque-types";
import type {
  OSCALAssessmentResult,
  OSCALMetadata,
  OSCALResult,
  OSCALFinding,
  OSCALObservation,
  OSCALControlSelection,
  OSCALReviewedControls,
} from "../output/oscal-types";

/**
 * Map a MARQUE document (JWT-VC or JSON) to an OSCAL Assessment Results document.
 *
 * If input is a string (JWT-VC), decodes the JWT payload and extracts the VC
 * to build a synthetic MarqueDocument for mapping.
 */
export function mapToOSCAL(input: MarqueDocument | string): OSCALAssessmentResult {
  let marque: MarqueDocument;

  if (typeof input === "string") {
    // JWT-VC path: decode payload and reconstruct MarqueDocument shape
    const parts = input.split(".");
    if (parts.length !== 3) throw new Error("Invalid JWT-VC format");
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    const vc = payload.vc;
    const subject = vc.credentialSubject;

    marque = {
      parley: "2.0",
      marque: {
        id: payload.jti || "unknown",
        version: "2.0.0",
        issuer: typeof vc.issuer === "string"
          ? { id: vc.issuer, name: vc.issuer }
          : { id: vc.issuer.id, name: vc.issuer.name || vc.issuer.id },
        generatedAt: vc.validFrom || new Date(payload.iat * 1000).toISOString(),
        expiresAt: vc.validUntil || new Date(payload.exp * 1000).toISOString(),
        scope: subject.scope,
        summary: subject.summary,
        evidenceChain: subject.evidenceChain,
        frameworks: subject.frameworks,
        threatModel: subject.threatModel,
        quartermasterAttestation: subject.quartermasterAttestation,
      },
      signature: parts[2],
    };
  } else {
    marque = input;
  }

  const now = marque.marque.generatedAt;
  const docUuid = crypto.randomUUID();
  const resultUuid = crypto.randomUUID();

  const metadata = buildMetadata(marque, now);
  const reviewedControls = buildReviewedControls(marque);
  const findings = buildFindings(marque);
  const observations = buildObservations(marque);

  const result: OSCALResult = {
    uuid: resultUuid,
    title: `MARQUE Assessment: ${marque.marque.issuer.name}`,
    description: `Assessment results derived from MARQUE ${marque.marque.id}`,
    start: marque.marque.generatedAt,
    end: marque.marque.expiresAt,
    "reviewed-controls": reviewedControls,
    findings,
    observations,
    risks: [],
  };

  return {
    "assessment-results": {
      uuid: docUuid,
      metadata,
      results: [result],
    },
  };
}

function buildMetadata(marque: MarqueDocument, now: string): OSCALMetadata {
  return {
    title: `OSCAL Assessment from MARQUE ${marque.marque.id}`,
    "last-modified": now,
    version: marque.marque.version,
    "oscal-version": "1.1.2",
    roles: [
      {
        id: "assessor",
        title: marque.marque.issuer.name,
        description: marque.marque.issuer.organization || "Corsair GRC Platform",
      },
    ],
    parties: [
      {
        uuid: crypto.randomUUID(),
        type: "organization",
        name: marque.marque.issuer.organization || marque.marque.issuer.name,
      },
    ],
  };
}

function buildReviewedControls(marque: MarqueDocument): OSCALReviewedControls {
  const controlSelections: OSCALControlSelection[] = [];

  for (const [frameworkName, frameworkData] of Object.entries(marque.marque.frameworks)) {
    if (frameworkData.controls.length > 0) {
      controlSelections.push({
        description: `${frameworkName} controls`,
        "include-controls": frameworkData.controls.map((ctrl) => ({
          "control-id": ctrl.controlId,
        })),
        props: [{ name: "framework", value: frameworkName }],
      });
    }
  }

  return {
    description: `Controls assessed in MARQUE ${marque.marque.id}`,
    "control-selections": controlSelections,
  };
}

function buildFindings(marque: MarqueDocument): OSCALFinding[] {
  const findings: OSCALFinding[] = [];

  for (const [frameworkName, frameworkData] of Object.entries(marque.marque.frameworks)) {
    for (const ctrl of frameworkData.controls) {
      findings.push({
        uuid: crypto.randomUUID(),
        title: `${frameworkName}: ${ctrl.controlId}`,
        description: `Control ${ctrl.controlId} from ${frameworkName}: ${ctrl.status}`,
        target: {
          type: "objective-id",
          "target-id": ctrl.controlId,
          status: ctrl.status === "passed" ? "satisfied" : "not-satisfied",
        },
        props: [
          { name: "framework", value: frameworkName },
          { name: "status", value: ctrl.status },
        ],
      });
    }
  }

  return findings;
}

function buildObservations(marque: MarqueDocument): OSCALObservation[] {
  const observations: OSCALObservation[] = [];

  // Evidence chain observation
  observations.push({
    uuid: crypto.randomUUID(),
    title: "Evidence Chain Verification",
    description: `Hash chain root: ${marque.marque.evidenceChain.hashChainRoot}, ${marque.marque.evidenceChain.recordCount} records, verified: ${marque.marque.evidenceChain.chainVerified}`,
    methods: ["TEST" as const],
    collected: marque.marque.generatedAt,
    props: [
      { name: "chain-verified", value: String(marque.marque.evidenceChain.chainVerified) },
      { name: "record-count", value: String(marque.marque.evidenceChain.recordCount) },
    ],
  });

  // Summary observation
  observations.push({
    uuid: crypto.randomUUID(),
    title: "Assessment Summary",
    description: `${marque.marque.summary.controlsTested} controls tested, ${marque.marque.summary.controlsPassed} passed, score: ${marque.marque.summary.overallScore}%`,
    methods: ["TEST" as const],
    collected: marque.marque.generatedAt,
    props: [
      { name: "controls-tested", value: String(marque.marque.summary.controlsTested) },
      { name: "controls-passed", value: String(marque.marque.summary.controlsPassed) },
      { name: "overall-score", value: String(marque.marque.summary.overallScore) },
    ],
  });

  // Threat model observation (if present)
  if (marque.marque.threatModel) {
    observations.push({
      uuid: crypto.randomUUID(),
      title: "Threat Model Analysis",
      description: `${marque.marque.threatModel.methodology}: ${marque.marque.threatModel.totalThreats} threats identified across ${marque.marque.threatModel.providersAnalyzed.join(", ")}`,
      methods: ["EXAMINE" as const],
      collected: marque.marque.generatedAt,
      props: [
        { name: "methodology", value: marque.marque.threatModel.methodology },
        { name: "total-threats", value: String(marque.marque.threatModel.totalThreats) },
      ],
    });
  }

  return observations;
}
