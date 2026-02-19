/**
 * JSON Parser — Generic Evidence Ingestion (Mapping-First)
 *
 * Accepts any JSON payload and normalizes it into IngestedDocument format.
 * Flow:
 *   1) Try mapping registry (config-driven)
 *   2) Fallback to generic { metadata, controls[] }
 *
 * All tool-specific logic should live in mapping packs.
 */

import { createHash } from "crypto";
import type {
  IngestedDocument,
  IngestedControl,
  DocumentMetadata,
  DocumentSource,
  FrameworkRef,
  AssessmentContext,
} from "./types";
import type { Severity } from "../types";
import { tryMapEvidence } from "./mapping-registry";

// =============================================================================
// PUBLIC API
// =============================================================================

export interface ParseJSONOptions {
  /** Override the detected source type */
  source?: DocumentSource;

  /** Force generic parsing (bypasses mapping registry) */
  format?: "generic";
}

/**
 * Parse any JSON payload into an IngestedDocument.
 *
 * Accepts:
 *   - A JSON string
 *   - A parsed object with { metadata?, controls[] }
 *   - Any tool output supported by mapping packs
 */
export function parseJSON(
  input: string | object,
  options?: ParseJSONOptions,
): IngestedDocument {
  const parsed = resolveInput(input);
  const rawHash = computeHash(parsed);

  // Format override — bypass mapping registry when explicitly set
  if (options?.format === "generic") {
    return parseGeneric(parsed as GenericInput, rawHash, options.source);
  }

  // Mapping registry — config-driven ingestion (tool-agnostic)
  const mapped = tryMapEvidence(parsed, rawHash, options?.source);
  if (mapped) {
    return mapped;
  }

  // Generic format: { metadata?, controls[], assessmentContext? }
  return parseGeneric(parsed as GenericInput, rawHash, options?.source);
}

// =============================================================================
// INPUT RESOLUTION
// =============================================================================

function resolveInput(input: string | object): unknown {
  if (input === null || input === undefined) {
    throw new Error("parseJSON: input must be a string or object, got null/undefined");
  }

  if (typeof input === "number" || typeof input === "boolean") {
    throw new Error(`parseJSON: input must be a string or object, got ${typeof input}`);
  }

  if (typeof input === "string") {
    try {
      return JSON.parse(input);
    } catch {
      throw new Error("parseJSON: invalid JSON string");
    }
  }

  return input;
}

function computeHash(parsed: unknown): string {
  const canonical = JSON.stringify(sortKeysDeep(parsed));
  return createHash("sha256").update(canonical).digest("hex");
}

function sortKeysDeep(value: unknown): unknown {
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

// =============================================================================
// GENERIC FORMAT PARSER
// =============================================================================

interface GenericInput {
  metadata?: Partial<DocumentMetadata>;
  controls?: GenericControl[];
  assessmentContext?: AssessmentContext;
}

interface GenericControl {
  id?: string;
  description?: string;
  status?: string;
  severity?: string;
  evidence?: string;
  framework?: string;
  controlId?: string;
  controlName?: string;
  frameworks?: Array<{ framework: string; controlId: string; controlName?: string }>;
}

function parseGeneric(
  input: GenericInput,
  rawHash: string,
  sourceOverride?: DocumentSource,
): IngestedDocument {
  const metadata: DocumentMetadata = {
    title: input.metadata?.title || "JSON Evidence Import",
    issuer: input.metadata?.issuer || "Unknown",
    date: input.metadata?.date || new Date().toISOString().split("T")[0],
    scope: input.metadata?.scope || "Unknown",
    auditor: input.metadata?.auditor,
    reportType: input.metadata?.reportType || "JSON",
    rawTextHash: rawHash,
  };

  const rawControls = input.controls || [];
  let autoIndex = 0;
  const controls: IngestedControl[] = rawControls.map((c) => {
    const frameworkRefs = extractFrameworkRefs(c);
    autoIndex++;
    return {
      id: c.id || `auto-${autoIndex}`,
      description: c.description || `Control ${c.id || autoIndex}`,
      status: normalizeStatus(c.status || "not-tested"),
      severity: c.severity ? normalizeSeverity(c.severity) : undefined,
      evidence: c.evidence,
      frameworkRefs: frameworkRefs.length > 0 ? frameworkRefs : undefined,
    };
  });

  return {
    source: sourceOverride || "json",
    metadata,
    controls,
    assessmentContext: input.assessmentContext,
  };
}

function extractFrameworkRefs(control: GenericControl): FrameworkRef[] {
  const refs: FrameworkRef[] = [];

  // Single framework reference: { framework, controlId }
  if (control.framework && control.controlId) {
    refs.push({
      framework: control.framework,
      controlId: control.controlId,
      controlName: control.controlName,
    });
  }

  // Array of framework references: { frameworks: [{ framework, controlId }] }
  if (Array.isArray(control.frameworks)) {
    for (const f of control.frameworks) {
      refs.push({
        framework: f.framework,
        controlId: f.controlId,
        controlName: f.controlName,
      });
    }
  }

  return refs;
}

// =============================================================================
// NORMALIZATION
// =============================================================================

function normalizeStatus(raw: string): "effective" | "ineffective" | "not-tested" {
  const lower = raw.toLowerCase().trim();
  switch (lower) {
    case "pass":
    case "passed":
    case "effective":
    case "compliant":
    case "success":
      return "effective";

    case "fail":
    case "failed":
    case "ineffective":
    case "non-compliant":
    case "error":
      return "ineffective";

    case "skip":
    case "skipped":
    case "not-tested":
    case "not_tested":
    case "not_available":
    case "info":
    case "informational":
    case "manual":
    case "unknown":
      return "not-tested";

    default:
      return "not-tested";
  }
}

function normalizeSeverity(raw: string): Severity {
  const lower = raw.toLowerCase().trim();
  switch (lower) {
    case "critical":
      return "CRITICAL";
    case "high":
      return "HIGH";
    case "medium":
      return "MEDIUM";
    case "low":
      return "LOW";
    case "informational":
    case "info":
      return "LOW";
    default:
      return raw.toUpperCase() as Severity;
  }
}
