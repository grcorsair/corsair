import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { resolve } from "path";
import * as crypto from "crypto";
import {
  canonicalizeMappingPack,
  isMappingPack,
  validateMappingSchema,
  type EvidenceMapping,
  type MappingPack,
  type MappingPackMetadata,
} from "./mapping-schema";

export interface MappingLoadError {
  path: string;
  error: string;
  mappingId?: string;
}

export interface MappingPackValidation {
  ok: boolean;
  errors: string[];
}

export interface MappingLoadResult {
  mappings: EvidenceMapping[];
  errors: MappingLoadError[];
}

// =============================================================================
// LOADERS
// =============================================================================

export function loadMappingsFromPaths(paths: string[]): MappingLoadResult {
  const mappings: EvidenceMapping[] = [];
  const errors: MappingLoadError[] = [];

  for (const path of paths) {
    if (!path) continue;
    if (!existsSync(path)) {
      errors.push({ path, error: "Path not found" });
      continue;
    }
    const stat = statSync(path);
    if (stat.isDirectory()) {
      loadMappingsFromDir(path, mappings, errors);
    } else if (stat.isFile()) {
      loadMappingFromFile(path, mappings, errors);
    }
  }

  const seen = new Set<string>();
  for (const mapping of mappings) {
    if (seen.has(mapping.id)) {
      errors.push({ path: "(pack)", error: "Duplicate mapping id", mappingId: mapping.id });
    }
    seen.add(mapping.id);
  }

  return { mappings, errors };
}

function loadMappingsFromDir(dir: string, target: EvidenceMapping[], errors: MappingLoadError[]): void {
  const entries = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name);
    loadMappingFromFile(fullPath, target, errors);
  }
}

function loadMappingFromFile(filePath: string, target: EvidenceMapping[], errors: MappingLoadError[]): void {
  try {
    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as EvidenceMapping | EvidenceMapping[] | MappingPack;

    if (isMappingPack(parsed)) {
      for (const m of parsed.mappings) {
        const schemaErrors = validateMappingSchema(m);
        if (schemaErrors.length > 0) {
          for (const err of schemaErrors) {
            errors.push({ path: filePath, error: err, mappingId: m?.id });
          }
          continue;
        }
        target.push(m);
      }
      return;
    }

    if (Array.isArray(parsed)) {
      for (const m of parsed) {
        const schemaErrors = validateMappingSchema(m);
        if (schemaErrors.length > 0) {
          for (const err of schemaErrors) {
            errors.push({ path: filePath, error: err, mappingId: m?.id });
          }
          continue;
        }
        target.push(m);
      }
      return;
    }

    const schemaErrors = validateMappingSchema(parsed);
    if (schemaErrors.length > 0) {
      for (const err of schemaErrors) {
        errors.push({ path: filePath, error: err, mappingId: parsed?.id });
      }
      return;
    }
    target.push(parsed);
  } catch {
    errors.push({ path: filePath, error: "Invalid JSON or unreadable mapping file" });
  }
}

// =============================================================================
// PACK HELPERS
// =============================================================================

export function createMappingPack(metadata: MappingPackMetadata, mappings: EvidenceMapping[]): MappingPack {
  return {
    pack: {
      id: metadata.id,
      version: metadata.version,
      ...(metadata.issuedAt ? { issuedAt: metadata.issuedAt } : {}),
    },
    mappings,
  };
}

export function validateMappingPack(pack: MappingPack): MappingPackValidation {
  const errors: string[] = [];

  if (!pack.pack?.id || typeof pack.pack.id !== "string") {
    errors.push("pack.id is required");
  }
  if (!pack.pack?.version || typeof pack.pack.version !== "string") {
    errors.push("pack.version is required");
  }
  if (!Array.isArray(pack.mappings) || pack.mappings.length === 0) {
    errors.push("mappings must be a non-empty array");
  } else {
    const seen = new Set<string>();
    for (const mapping of pack.mappings) {
      const schemaErrors = validateMappingSchema(mapping);
      errors.push(...schemaErrors.map(e => `mapping ${mapping?.id || "(unknown)"}: ${e}`));
      if (mapping?.id) {
        if (seen.has(mapping.id)) {
          errors.push(`duplicate mapping id: ${mapping.id}`);
        }
        seen.add(mapping.id);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function signMappingPack(pack: MappingPack, privateKeyPem: string): MappingPack {
  const canonical = canonicalizeMappingPack({ pack: pack.pack, mappings: pack.mappings });
  const signature = crypto.sign(
    null,
    Buffer.from(canonical),
    { key: privateKeyPem, format: "pem", type: "pkcs8" },
  ).toString("base64");

  return { ...pack, signature };
}
