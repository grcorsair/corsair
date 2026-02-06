/**
 * OSCAL Generator
 *
 * Converts Corsair JSONL evidence and ChartResult into OSCAL Assessment Results
 * format per NIST SP 800-53A.
 *
 * Mapping strategy:
 *   - ISC criteria  -> OSCAL findings (satisfied/not-satisfied)
 *   - MARK findings -> OSCAL observations (collected via automated TEST method)
 *   - RAID results  -> OSCAL risks (open for successful attacks, closed for blocked)
 *   - ChartResult   -> OSCAL reviewed-controls / control-selections
 */

import type {
  DriftFinding,
  ChartResult,
  RaidResult,
  Framework,
  ThreatModelResult,
} from "../types";

import type {
  OSCALAssessmentResult,
  OSCALMetadata,
  OSCALResult,
  OSCALFinding,
  OSCALFindingTarget,
  OSCALFindingTargetStatus,
  OSCALObservation,
  OSCALRisk,
  OSCALRiskStatus,
  OSCALControlSelection,
  OSCALReviewedControls,
  OSCALCharacterization,
  OSCALProperty,
} from "./oscal-types";

// ===============================================================================
// GENERATOR OPTIONS
// ===============================================================================

export interface OSCALGeneratorOptions {
  findings: DriftFinding[];
  chartResult: ChartResult;
  raidResults?: RaidResult[];
  iscCriteria?: { text: string; satisfaction: string }[];
  metadata?: { title?: string; description?: string };
  threatModel?: ThreatModelResult;
}

// ===============================================================================
// OSCAL GENERATOR
// ===============================================================================

export class OSCALGenerator {
  /**
   * Generate an OSCAL Assessment Results document from Corsair data.
   */
  generate(options: OSCALGeneratorOptions): OSCALAssessmentResult {
    const {
      findings,
      chartResult,
      raidResults = [],
      iscCriteria = [],
      metadata: customMetadata,
    } = options;

    const now = new Date().toISOString();
    const docUuid = crypto.randomUUID();
    const resultUuid = crypto.randomUUID();

    const threatModel = options.threatModel;

    const metadata = this.buildMetadata(customMetadata, now);
    const observations = this.buildObservations(findings);

    // Add threat model findings as additional observations
    if (threatModel) {
      for (const threat of threatModel.threats) {
        observations.push({
          uuid: crypto.randomUUID(),
          title: `STRIDE Threat: ${threat.stride} - ${threat.affectedField}`,
          description: threat.description,
          methods: ["EXAMINE" as const],
          collected: threatModel.analyzedAt,
          props: [
            { name: "stride-category", value: threat.stride },
            { name: "mitre-technique", value: threat.mitreTechnique },
            { name: "mitre-name", value: threat.mitreName },
            { name: "severity", value: threat.severity },
            { name: "affected-field", value: threat.affectedField },
            { name: "methodology", value: "STRIDE-automated" },
          ],
        });
      }
    }

    const risks = this.buildRisks(raidResults);
    const oscalFindings = this.buildFindings(iscCriteria, observations, risks);
    const reviewedControls = this.buildReviewedControls(chartResult);

    const result: OSCALResult = {
      uuid: resultUuid,
      title: customMetadata?.title || "Corsair Assessment Result",
      description: "Automated GRC chaos engineering assessment results",
      start: findings.length > 0 ? findings[0].timestamp : now,
      end: now,
      "reviewed-controls": reviewedControls,
      findings: oscalFindings,
      observations,
      risks,
    };

    return {
      "assessment-results": {
        uuid: docUuid,
        metadata,
        results: [result],
      },
    };
  }

  /**
   * Serialize an OSCAL Assessment Result to a pretty-printed JSON string.
   */
  toJSON(result: OSCALAssessmentResult): string {
    return JSON.stringify(result, null, 2);
  }

  // ===============================================================================
  // METADATA
  // ===============================================================================

  private buildMetadata(
    custom: { title?: string; description?: string } | undefined,
    now: string
  ): OSCALMetadata {
    const metadata: OSCALMetadata = {
      title: custom?.title || "Corsair Assessment Report",
      "last-modified": now,
      version: "1.0.0",
      "oscal-version": "1.1.2",
    };

    if (custom?.description) {
      metadata.remarks = custom.description;
    }

    metadata.roles = [
      {
        id: "assessor",
        title: "Corsair Automated Assessor",
        description: "Automated GRC chaos engineering assessment engine",
      },
    ];

    metadata.parties = [
      {
        uuid: crypto.randomUUID(),
        type: "organization",
        name: "Corsair GRC Platform",
      },
    ];

    return metadata;
  }

  // ===============================================================================
  // OBSERVATIONS (from MARK DriftFindings)
  // ===============================================================================

  private buildObservations(findings: DriftFinding[]): OSCALObservation[] {
    return findings.map((finding) => {
      const props: OSCALProperty[] = [
        { name: "severity", value: finding.severity },
        { name: "drift-detected", value: String(finding.drift) },
        { name: "expected", value: String(finding.expected) },
        { name: "actual", value: String(finding.actual) },
      ];

      return {
        uuid: crypto.randomUUID(),
        title: `Drift: ${finding.field}`,
        description: finding.description || `Configuration drift detected in ${finding.field}`,
        methods: ["TEST" as const],
        collected: finding.timestamp,
        props,
      };
    });
  }

  // ===============================================================================
  // RISKS (from RAID Results)
  // ===============================================================================

  private buildRisks(raidResults: RaidResult[]): OSCALRisk[] {
    return raidResults.map((raid) => {
      const status: OSCALRiskStatus = raid.success ? "open" : "closed";

      const characterization: OSCALCharacterization = {
        facets: [
          {
            name: "attack-vector",
            system: "corsair",
            value: raid.vector,
          },
          {
            name: "controls-held",
            system: "corsair",
            value: String(raid.controlsHeld),
          },
          {
            name: "duration-ms",
            system: "corsair",
            value: String(raid.durationMs),
          },
        ],
      };

      const props: OSCALProperty[] = [
        { name: "raid-id", value: raid.raidId },
        { name: "target", value: raid.target },
      ];

      if (raid.success) {
        props.push({ name: "attack-succeeded", value: "true" });
      }

      const findingsSummary = raid.findings.length > 0
        ? raid.findings.join("; ")
        : "No findings recorded";

      return {
        uuid: crypto.randomUUID(),
        title: `RAID: ${raid.vector} against ${raid.target}`,
        description: `Attack simulation using vector "${raid.vector}" targeting ${raid.target}. ${raid.success ? "Attack succeeded - control gap identified." : "Attack blocked - controls operating effectively."}`,
        statement: findingsSummary,
        status,
        characterizations: [characterization],
        props,
      };
    });
  }

  // ===============================================================================
  // FINDINGS (from ISC Criteria)
  // ===============================================================================

  private buildFindings(
    iscCriteria: { text: string; satisfaction: string }[],
    observations: OSCALObservation[],
    risks: OSCALRisk[]
  ): OSCALFinding[] {
    return iscCriteria.map((isc, index) => {
      const targetStatus: OSCALFindingTargetStatus =
        isc.satisfaction === "SATISFIED" ? "satisfied" : "not-satisfied";

      const target: OSCALFindingTarget = {
        type: "objective-id",
        "target-id": `ISC-${String(index + 1).padStart(3, "0")}`,
        status: targetStatus,
      };

      const finding: OSCALFinding = {
        uuid: crypto.randomUUID(),
        title: `ISC: ${isc.text}`,
        description: `Ideal State Criterion: "${isc.text}" - Status: ${isc.satisfaction}`,
        target,
        props: [
          { name: "isc-text", value: isc.text },
          { name: "isc-satisfaction", value: isc.satisfaction },
        ],
      };

      // Link observations to findings
      if (observations.length > 0) {
        finding["observation-uuids"] = observations.map((o) => o.uuid);
      }

      // Link risks to findings
      if (risks.length > 0) {
        finding["risk-uuids"] = risks.map((r) => r.uuid);
      }

      return finding;
    });
  }

  // ===============================================================================
  // REVIEWED CONTROLS (from ChartResult)
  // ===============================================================================

  private buildReviewedControls(chartResult: ChartResult): OSCALReviewedControls {
    const controlSelections: OSCALControlSelection[] = [];

    // NIST CSF controls from the legacy fields
    if (chartResult.nist.controls.length > 0) {
      controlSelections.push({
        description: `NIST CSF: ${chartResult.nist.function}`,
        "include-controls": chartResult.nist.controls.map((controlId) => ({
          "control-id": controlId,
        })),
        props: [
          { name: "framework", value: "NIST-CSF" },
          { name: "category", value: chartResult.nist.category },
        ],
      });
    }

    // SOC2 criteria from the legacy fields
    if (chartResult.soc2.criteria.length > 0) {
      controlSelections.push({
        description: `SOC2: ${chartResult.soc2.principle} - ${chartResult.soc2.description}`,
        "include-controls": chartResult.soc2.criteria.map((criterionId) => ({
          "control-id": criterionId,
        })),
        props: [{ name: "framework", value: "SOC2" }],
      });
    }

    // Extended frameworks from the frameworks field
    if (chartResult.frameworks) {
      for (const [framework, data] of Object.entries(chartResult.frameworks)) {
        if (data.controls.length > 0) {
          controlSelections.push({
            description: `${framework} controls`,
            "include-controls": data.controls.map((ctrl) => ({
              "control-id": ctrl.controlId,
            })),
            props: [{ name: "framework", value: framework }],
          });
        }
      }
    }

    return {
      description: "Controls assessed during Corsair GRC chaos engineering run",
      "control-selections": controlSelections,
    };
  }
}
