import type { Severity } from "../types";

// =============================================================================
// TYPES
// =============================================================================

export interface EvidenceMapping {
  id: string;
  name?: string;
  source?: string;
  /** Higher priority mappings are evaluated first */
  priority?: number;
  match?: {
    allOf?: string[];
    anyOf?: string[];
  };
  metadata?: {
    title?: string;
    titlePath?: string;
    issuer?: string;
    issuerPath?: string;
    date?: string;
    datePath?: string;
    scope?: string;
    scopePath?: string;
    reportType?: string;
    reportTypePath?: string;
  };
  controls?: {
    path: string;
    idPath?: string;
    descriptionPath?: string;
    statusPath?: string;
    statusMap?: Record<string, "effective" | "ineffective" | "not-tested">;
    severityPath?: string;
    severityMap?: Record<string, Severity>;
    evidencePath?: string;
    frameworkRefs?: {
      path: string;
      frameworkPath?: string;
      controlIdPath?: string;
      controlNamePath?: string;
    };
  };
  passthrough?: {
    paths?: Record<string, string>;
  };
}

export interface MappingPackMetadata {
  id: string;
  version: string;
  issuedAt?: string;
}

export interface MappingPack {
  pack: MappingPackMetadata;
  mappings: EvidenceMapping[];
  signature?: string;
}

// =============================================================================
// PACK HELPERS
// =============================================================================

export function isMappingPack(value: unknown): value is MappingPack {
  if (!value || typeof value !== "object") return false;
  const pack = value as MappingPack;
  return Boolean(pack.pack && typeof pack.pack === "object" && Array.isArray(pack.mappings));
}

export function canonicalizeMappingPack(pack: { pack: MappingPackMetadata; mappings: EvidenceMapping[] }): string {
  return JSON.stringify(sortKeysDeep({ pack: pack.pack, mappings: pack.mappings }));
}

// =============================================================================
// SCHEMA VALIDATION
// =============================================================================

export function validateMappingSchema(mapping: EvidenceMapping): string[] {
  const errors: string[] = [];

  if (!mapping || typeof mapping !== "object") {
    errors.push("Mapping must be an object");
    return errors;
  }

  if (!mapping.id || typeof mapping.id !== "string") {
    errors.push("Missing required mapping id");
  }

  const hasMatch = Boolean((mapping.match?.allOf && mapping.match.allOf.length > 0)
    || (mapping.match?.anyOf && mapping.match.anyOf.length > 0));
  if (!hasMatch) {
    errors.push("Missing match rules (allOf/anyOf)");
  }

  if (mapping.controls && !mapping.controls.path) {
    errors.push("controls.path is required when controls is present");
  }

  const hasControls = Boolean(mapping.controls?.path);
  const hasPassthrough = Boolean(mapping.passthrough?.paths && Object.keys(mapping.passthrough.paths).length > 0);
  if (!hasControls && !hasPassthrough) {
    errors.push("Mapping has neither controls nor passthrough paths");
  }

  if (mapping.passthrough?.paths) {
    for (const [key, value] of Object.entries(mapping.passthrough.paths)) {
      if (!key || typeof value !== "string") {
        errors.push("passthrough.paths must be a map of string keys to string paths");
        break;
      }
    }
  }

  if (mapping.controls?.statusMap) {
    const allowed = new Set(["effective", "ineffective", "not-tested"]);
    for (const value of Object.values(mapping.controls.statusMap)) {
      if (!allowed.has(value)) {
        errors.push("controls.statusMap values must be effective|ineffective|not-tested");
        break;
      }
    }
  }

  if (mapping.controls?.severityMap) {
    const allowed = new Set(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);
    for (const value of Object.values(mapping.controls.severityMap)) {
      if (!allowed.has(value)) {
        errors.push("controls.severityMap values must be CRITICAL|HIGH|MEDIUM|LOW");
        break;
      }
    }
  }

  return errors;
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
