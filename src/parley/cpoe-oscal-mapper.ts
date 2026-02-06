/**
 * CPOE to OSCAL Mapper
 *
 * Converts a CPOEDocument into an OSCALAssessmentResult, allowing
 * CPOE data to be consumed by OSCAL-compatible tools and auditors.
 *
 * Mapping:
 *   - CPOE frameworks → OSCAL reviewed-controls / control-selections
 *   - CPOE evidence chain → OSCAL observations
 *   - CPOE summary → OSCAL result metadata
 */

import type { CPOEDocument } from "./cpoe-types";
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
 * Map a CPOE document to an OSCAL Assessment Results document.
 */
export function mapToOSCAL(cpoe: CPOEDocument): OSCALAssessmentResult {
  const now = cpoe.cpoe.generatedAt;
  const docUuid = crypto.randomUUID();
  const resultUuid = crypto.randomUUID();

  const metadata = buildMetadata(cpoe, now);
  const reviewedControls = buildReviewedControls(cpoe);
  const findings = buildFindings(cpoe);
  const observations = buildObservations(cpoe);

  const result: OSCALResult = {
    uuid: resultUuid,
    title: `CPOE Assessment: ${cpoe.cpoe.issuer.name}`,
    description: `Assessment results derived from CPOE ${cpoe.cpoe.id}`,
    start: cpoe.cpoe.generatedAt,
    end: cpoe.cpoe.expiresAt,
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

function buildMetadata(cpoe: CPOEDocument, now: string): OSCALMetadata {
  return {
    title: `OSCAL Assessment from CPOE ${cpoe.cpoe.id}`,
    "last-modified": now,
    version: cpoe.cpoe.version,
    "oscal-version": "1.1.2",
    roles: [
      {
        id: "assessor",
        title: cpoe.cpoe.issuer.name,
        description: cpoe.cpoe.issuer.organization || "Corsair GRC Platform",
      },
    ],
    parties: [
      {
        uuid: crypto.randomUUID(),
        type: "organization",
        name: cpoe.cpoe.issuer.organization || cpoe.cpoe.issuer.name,
      },
    ],
  };
}

function buildReviewedControls(cpoe: CPOEDocument): OSCALReviewedControls {
  const controlSelections: OSCALControlSelection[] = [];

  for (const [frameworkName, frameworkData] of Object.entries(cpoe.cpoe.frameworks)) {
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
    description: `Controls assessed in CPOE ${cpoe.cpoe.id}`,
    "control-selections": controlSelections,
  };
}

function buildFindings(cpoe: CPOEDocument): OSCALFinding[] {
  const findings: OSCALFinding[] = [];

  for (const [frameworkName, frameworkData] of Object.entries(cpoe.cpoe.frameworks)) {
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

function buildObservations(cpoe: CPOEDocument): OSCALObservation[] {
  const observations: OSCALObservation[] = [];

  // Evidence chain observation
  observations.push({
    uuid: crypto.randomUUID(),
    title: "Evidence Chain Verification",
    description: `Hash chain root: ${cpoe.cpoe.evidenceChain.hashChainRoot}, ${cpoe.cpoe.evidenceChain.recordCount} records, verified: ${cpoe.cpoe.evidenceChain.chainVerified}`,
    methods: ["TEST" as const],
    collected: cpoe.cpoe.generatedAt,
    props: [
      { name: "chain-verified", value: String(cpoe.cpoe.evidenceChain.chainVerified) },
      { name: "record-count", value: String(cpoe.cpoe.evidenceChain.recordCount) },
    ],
  });

  // Summary observation
  observations.push({
    uuid: crypto.randomUUID(),
    title: "Assessment Summary",
    description: `${cpoe.cpoe.summary.controlsTested} controls tested, ${cpoe.cpoe.summary.controlsPassed} passed, score: ${cpoe.cpoe.summary.overallScore}%`,
    methods: ["TEST" as const],
    collected: cpoe.cpoe.generatedAt,
    props: [
      { name: "controls-tested", value: String(cpoe.cpoe.summary.controlsTested) },
      { name: "controls-passed", value: String(cpoe.cpoe.summary.controlsPassed) },
      { name: "overall-score", value: String(cpoe.cpoe.summary.overallScore) },
    ],
  });

  // Threat model observation (if present)
  if (cpoe.cpoe.threatModel) {
    observations.push({
      uuid: crypto.randomUUID(),
      title: "Threat Model Analysis",
      description: `${cpoe.cpoe.threatModel.methodology}: ${cpoe.cpoe.threatModel.totalThreats} threats identified across ${cpoe.cpoe.threatModel.providersAnalyzed.join(", ")}`,
      methods: ["EXAMINE" as const],
      collected: cpoe.cpoe.generatedAt,
      props: [
        { name: "methodology", value: cpoe.cpoe.threatModel.methodology },
        { name: "total-threats", value: String(cpoe.cpoe.threatModel.totalThreats) },
      ],
    });
  }

  return observations;
}
