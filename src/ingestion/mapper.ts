/**
 * Ingestion Mapper — IngestedDocument → MarqueGeneratorInput
 *
 * Converts the canonical IngestedDocument format into the MarqueGeneratorInput
 * expected by the existing signing pipeline. This is the bridge between
 * document parsing and CPOE generation.
 *
 * Controls become DriftFindings (markResults).
 * Framework references become ChartResult frameworks.
 * RaidResults are empty (no attacks were run — this is document ingestion).
 * EvidencePaths are empty (no JSONL files — evidence is in the document).
 */

import type { MarqueGeneratorInput } from "../parley/marque-generator";
import type { MarqueIssuer } from "../parley/marque-types";
import type { MarkResult, DriftFinding, ChartResult, Severity, Framework } from "../types";
import type { IngestedDocument, IngestedControl } from "./types";

// =============================================================================
// OPTIONS
// =============================================================================

export interface MapperOptions {
  /** DID for the issuer (e.g., "did:web:acme.com") */
  did?: string;

  /** Custom issuer ID (defaults to document metadata issuer) */
  issuerId?: string;

  /** Custom organization name */
  organization?: string;

  /** Process receipt chain from pipeline steps */
  processReceipts?: import("../parley/process-receipt").ProcessReceipt[];
}

// =============================================================================
// MAPPER
// =============================================================================

/**
 * Map an IngestedDocument to MarqueGeneratorInput.
 *
 * This is the core bridge: any parser that outputs IngestedDocument
 * can feed into the existing MARQUE signing pipeline.
 */
export function mapToMarqueInput(
  doc: IngestedDocument,
  options?: MapperOptions,
): MarqueGeneratorInput {
  const issuer = buildIssuer(doc, options);
  const markResults = buildMarkResults(doc.controls);
  const chartResults = buildChartResults(doc.controls);

  return {
    document: doc,
    markResults,
    raidResults: [], // No attacks run during document ingestion
    chartResults,
    evidencePaths: [], // No JSONL evidence files
    issuer,
    providers: [`${doc.source}-document`],
    processReceipts: options?.processReceipts,
  };
}

// =============================================================================
// INTERNAL: ISSUER
// =============================================================================

function buildIssuer(doc: IngestedDocument, options?: MapperOptions): MarqueIssuer {
  return {
    id: options?.issuerId || `ingestion-${doc.source}`,
    name: doc.metadata.issuer,
    organization: options?.organization || doc.metadata.issuer,
    did: options?.did,
  };
}

// =============================================================================
// INTERNAL: MARK RESULTS (controls → drift findings)
// =============================================================================

function buildMarkResults(controls: IngestedControl[]): MarkResult[] {
  const findings: DriftFinding[] = controls.map(controlToFinding);
  const driftDetected = findings.some(f => f.drift);

  return [{
    findings,
    driftDetected,
    durationMs: 0,
  }];
}

function controlToFinding(control: IngestedControl): DriftFinding {
  const drift = control.status === "ineffective";

  return {
    id: control.id,
    field: control.id,
    expected: "effective",
    actual: control.status,
    drift,
    severity: control.severity || "MEDIUM" as Severity,
    description: control.description,
    timestamp: new Date().toISOString(),
  };
}

// =============================================================================
// INTERNAL: CHART RESULTS (framework refs → framework mappings)
// =============================================================================

function buildChartResults(controls: IngestedControl[]): ChartResult[] {
  // Aggregate all framework references across all controls
  const frameworkMap = new Map<string, Map<string, { controlId: string; controlName: string; status: string }>>();

  for (const control of controls) {
    if (!control.frameworkRefs) continue;

    const status = control.status === "effective" ? "passed"
      : control.status === "ineffective" ? "failed"
      : "not-tested";

    for (const ref of control.frameworkRefs) {
      if (!frameworkMap.has(ref.framework)) {
        frameworkMap.set(ref.framework, new Map());
      }
      const controls = frameworkMap.get(ref.framework)!;
      // Use controlId as key to avoid duplicates; last write wins for status
      controls.set(ref.controlId, {
        controlId: ref.controlId,
        controlName: ref.controlName || ref.controlId,
        status,
      });
    }
  }

  // Convert to ChartResult format
  const frameworks: Record<Framework, { controls: { controlId: string; controlName: string; status: string }[] }> = {};

  for (const [framework, controlMap] of frameworkMap) {
    frameworks[framework] = {
      controls: Array.from(controlMap.values()),
    };
  }

  return [{
    // Legacy fields — populated with first MITRE mapping if available, otherwise empty
    mitre: { technique: "", name: "", tactic: "", description: "" },
    nist: { function: "", category: "", controls: [] },
    soc2: { principle: "", criteria: [], description: "" },
    frameworks,
  }];
}
