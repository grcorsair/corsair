/**
 * Mapping Registry — Config-Driven Evidence Ingestion
 *
 * Loads JSON mapping files from:
 * - Built-in mappings directory (src/ingestion/mappings)
 * - Optional external directory via CORSAIR_MAPPING_DIR (comma-separated)
 *
 * A mapping can extract:
 * - Document metadata (title, issuer, date, scope, reportType)
 * - Controls (id, description, status, severity, evidence, framework refs)
 * - Passthrough fields (extensions) for evidence-only CPOEs
 */

import { existsSync, readdirSync, readFileSync } from "fs";
import * as crypto from "crypto";
import { resolve } from "path";
import { fileURLToPath } from "url";
import type { IngestedControl, IngestedDocument } from "./types";
import {
  canonicalizeMappingPack,
  isMappingPack,
  validateMappingSchema,
  type EvidenceMapping,
  type MappingPack,
} from "./mapping-schema";

// =============================================================================
// TYPES
// =============================================================================

export type { EvidenceMapping } from "./mapping-schema";

// =============================================================================
// REGISTRY (CACHED)
// =============================================================================

let cachedMappings: EvidenceMapping[] | null = null;
const mappingOrderSymbol = Symbol("mappingOrder");
let mappingOrderCounter = 0;

type MappingWithOrder = EvidenceMapping & { [mappingOrderSymbol]?: number };

export interface MappingLoadError {
  path: string;
  error: string;
  mappingId?: string;
}

export function resetMappingRegistry(): void {
  cachedMappings = null;
  mappingOrderCounter = 0;
}

export function getMappings(): EvidenceMapping[] {
  if (cachedMappings) return cachedMappings;

  const result = loadAllMappings();
  cachedMappings = sortMappings(result.mappings);
  return result.mappings;
}

export function getMappingsWithDiagnostics(): { mappings: EvidenceMapping[]; errors: MappingLoadError[] } {
  const result = loadAllMappings();
  cachedMappings = sortMappings(result.mappings);
  return result;
}

function loadAllMappings(): { mappings: EvidenceMapping[]; errors: MappingLoadError[] } {
  const mappings: EvidenceMapping[] = [];
  const errors: MappingLoadError[] = [];

  const builtinDir = resolve(fileURLToPath(new URL("./mappings", import.meta.url)));
  loadMappingsFromDir(builtinDir, mappings, errors);

  const extraDirs = (process.env.CORSAIR_MAPPING_DIR || "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);

  for (const dir of extraDirs) {
    loadMappingsFromDir(dir, mappings, errors);
  }

  const extraFiles = (process.env.CORSAIR_MAPPING_FILE || "")
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  for (const filePath of extraFiles) {
    loadMappingFromFile(filePath, mappings, errors);
  }

  return { mappings, errors };
}

function loadMappingsFromDir(
  dir: string,
  target: EvidenceMapping[],
  errors: MappingLoadError[],
): void {
  if (!dir || !existsSync(dir)) return;

  const entries = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name);
    loadMappingFromFile(fullPath, target, errors);
  }
}

function loadMappingFromFile(
  filePath: string,
  target: EvidenceMapping[],
  errors: MappingLoadError[],
): void {
  if (!filePath || !existsSync(filePath)) return;
  try {
    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as EvidenceMapping | EvidenceMapping[] | MappingPack;

    if (isMappingPack(parsed)) {
      loadMappingPack(parsed, filePath, target, errors);
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
        pushMapping(m, target);
      }
    } else {
      const schemaErrors = validateMappingSchema(parsed);
      if (schemaErrors.length > 0) {
        for (const err of schemaErrors) {
          errors.push({ path: filePath, error: err, mappingId: parsed?.id });
        }
        return;
      }
      pushMapping(parsed, target);
    }
  } catch {
    // Non-fatal: log warning for visibility
    console.warn(`Mapping registry: failed to load ${filePath} (invalid JSON)`);
    errors.push({ path: filePath, error: "Invalid JSON or unreadable mapping file" });
    return;
  }
}

function pushMapping(mapping: EvidenceMapping, target: EvidenceMapping[]): void {
  const withOrder = mapping as MappingWithOrder;
  withOrder[mappingOrderSymbol] = mappingOrderCounter++;
  target.push(mapping);
}

function sortMappings(mappings: EvidenceMapping[]): EvidenceMapping[] {
  return mappings.sort((a, b) => {
    const pa = a.priority ?? 0;
    const pb = b.priority ?? 0;
    if (pa !== pb) return pb - pa;
    const oa = (a as MappingWithOrder)[mappingOrderSymbol] ?? 0;
    const ob = (b as MappingWithOrder)[mappingOrderSymbol] ?? 0;
    return oa - ob;
  });
}

function loadMappingPack(
  pack: MappingPack,
  filePath: string,
  target: EvidenceMapping[],
  errors: MappingLoadError[],
): void {
  if (!pack.pack?.id || !pack.pack?.version) {
    errors.push({ path: filePath, error: "Mapping pack missing pack.id or pack.version" });
    return;
  }

  if (pack.signature) {
    const publicKey = process.env.CORSAIR_MAPPING_PACK_PUBKEY;
    if (!publicKey) {
      errors.push({ path: filePath, error: "Signed mapping pack requires CORSAIR_MAPPING_PACK_PUBKEY" });
      return;
    }
    const canonical = canonicalizeMappingPack({ pack: pack.pack, mappings: pack.mappings });
    const ok = crypto.verify(
      null,
      Buffer.from(canonical),
      { key: publicKey, format: "pem", type: "spki" },
      Buffer.from(pack.signature, "base64"),
    );
    if (!ok) {
      errors.push({ path: filePath, error: "Mapping pack signature invalid", mappingId: pack.pack.id });
      return;
    }
  }

  for (const m of pack.mappings) {
    const schemaErrors = validateMappingSchema(m);
    if (schemaErrors.length > 0) {
      for (const err of schemaErrors) {
        errors.push({ path: filePath, error: err, mappingId: m?.id });
      }
      continue;
    }
    pushMapping(m, target);
  }
}

// =============================================================================
// MAPPING APPLICATION
// =============================================================================

export function tryMapEvidence(
  input: unknown,
  rawHash: string,
  sourceOverride?: string,
): IngestedDocument | null {
  const mappings = getMappings();
  for (const mapping of mappings) {
    if (!mapping || !mapping.id) continue;
    if (!matchesMapping(input, mapping)) continue;
    return applyMapping(input, mapping, rawHash, sourceOverride);
  }
  return null;
}

export function mapEvidenceWithMapping(
  input: unknown,
  mapping: EvidenceMapping,
  rawHash: string,
  sourceOverride?: string,
): IngestedDocument | null {
  if (!mapping || !matchesMapping(input, mapping)) return null;
  return applyMapping(input, mapping, rawHash, sourceOverride);
}

function matchesMapping(input: unknown, mapping: EvidenceMapping): boolean {
  if (!mapping.match) return false;

  if (mapping.match.allOf && mapping.match.allOf.length > 0) {
    for (const path of mapping.match.allOf) {
      const value = resolvePath(input, path, input);
      if (value === undefined) return false;
      if (Array.isArray(value) && value.length === 0) return false;
    }
  }

  if (mapping.match.anyOf && mapping.match.anyOf.length > 0) {
    let any = false;
    for (const path of mapping.match.anyOf) {
      const value = resolvePath(input, path, input);
      if (value !== undefined && (!Array.isArray(value) || value.length > 0)) {
        any = true;
        break;
      }
    }
    if (!any) return false;
  }

  return true;
}

function applyMapping(
  input: unknown,
  mapping: EvidenceMapping,
  rawHash: string,
  sourceOverride?: string,
): IngestedDocument {
  const metadata = buildMetadata(input, mapping, rawHash);
  const controls = buildControls(input, mapping);
  const passthrough = buildPassthrough(input, mapping);

  const extensions: Record<string, unknown> = {
    ...(passthrough ? { passthrough } : {}),
    mapping: {
      id: mapping.id,
      name: mapping.name,
      evidenceOnly: controls.length === 0,
    },
  };

  return {
    source: (sourceOverride || mapping.source || "json") as any,
    metadata,
    controls,
    extensions,
  };
}

function buildMetadata(
  input: unknown,
  mapping: EvidenceMapping,
  rawHash: string,
) {
  const meta = mapping.metadata || {};
  return {
    title: (pick(meta.titlePath, input) ?? meta.title ?? "JSON Evidence Import") as string,
    issuer: (pick(meta.issuerPath, input) ?? meta.issuer ?? "Unknown") as string,
    date: (pick(meta.datePath, input) ?? meta.date ?? new Date().toISOString().split("T")[0]) as string,
    scope: (pick(meta.scopePath, input) ?? meta.scope ?? "Unknown") as string,
    reportType: (pick(meta.reportTypePath, input) ?? meta.reportType ?? "JSON") as string,
    rawTextHash: rawHash,
  };
}

function buildControls(input: unknown, mapping: EvidenceMapping): IngestedControl[] {
  if (!mapping.controls) return [];

  const raw = resolvePath(input, mapping.controls.path, input);
  const items = Array.isArray(raw) ? raw : raw !== undefined ? [raw] : [];

  let autoIndex = 0;
  return items.map((item) => {
    autoIndex++;
    const id = pick(mapping.controls!.idPath, item, input);
    const description = pick(mapping.controls!.descriptionPath, item, input);
    const statusRaw = pick(mapping.controls!.statusPath, item, input);
    const severityRaw = pick(mapping.controls!.severityPath, item, input);
    const evidence = pick(mapping.controls!.evidencePath, item, input);

    const status = normalizeStatus(statusRaw, mapping.controls!.statusMap);
    const severity = normalizeSeverity(severityRaw, mapping.controls!.severityMap);

    const frameworkRefs = buildFrameworkRefs(item, input, mapping);

    return {
      id: (id ?? `auto-${autoIndex}`) as string,
      description: (description ?? `Control ${id ?? autoIndex}`) as string,
      status,
      ...(severity ? { severity } : {}),
      ...(evidence ? { evidence: String(evidence) } : {}),
      ...(frameworkRefs.length > 0 ? { frameworkRefs } : {}),
    };
  });
}

function buildFrameworkRefs(
  item: unknown,
  root: unknown,
  mapping: EvidenceMapping,
) {
  const refs = mapping.controls?.frameworkRefs;
  if (!refs?.path) return [];

  const raw = resolvePath(item, refs.path, root);
  const items = Array.isArray(raw) ? raw : raw !== undefined ? [raw] : [];

  const out: Array<{ framework: string; controlId: string; controlName?: string }> = [];
  for (const ref of items) {
    const framework = pick(refs.frameworkPath, ref, root);
    const controlId = pick(refs.controlIdPath, ref, root);
    const controlName = pick(refs.controlNamePath, ref, root);
    if (!framework || !controlId) continue;
    out.push({
      framework: String(framework),
      controlId: String(controlId),
      ...(controlName ? { controlName: String(controlName) } : {}),
    });
  }
  return out;
}

function buildPassthrough(input: unknown, mapping: EvidenceMapping): Record<string, unknown> | null {
  if (!mapping.passthrough?.paths) return null;

  const out: Record<string, unknown> = {};
  for (const [key, path] of Object.entries(mapping.passthrough.paths)) {
    const value = resolvePath(input, path, input);
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

// =============================================================================
// PATH RESOLUTION (SIMPLE JSON PATH)
// =============================================================================

function pick(path: string | undefined, current: unknown, root?: unknown): unknown {
  if (!path) return undefined;
  return resolvePath(current, path, root ?? current);
}

function resolvePath(current: unknown, path: string, root: unknown): unknown {
  if (!path) return undefined;

  let base: unknown = current;
  let rawPath = path.trim();

  if (rawPath.startsWith("$")) {
    base = root;
    rawPath = rawPath.replace(/^\$\.?/, "");
  } else if (rawPath.startsWith("@")) {
    base = current;
    rawPath = rawPath.replace(/^@\.?/, "");
  }

  if (!rawPath) return base;

  const tokens = tokenizePath(rawPath);
  return walkPath(base, tokens);
}

function tokenizePath(path: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inBracket = false;

  for (let i = 0; i < path.length; i++) {
    const ch = path[i];

    if (ch === "." && !inBracket) {
      if (current.length > 0) tokens.push(current);
      current = "";
      continue;
    }

    if (ch === "[") {
      inBracket = true;
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    if (ch === "]") {
      inBracket = false;
      if (current.length > 0) tokens.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  if (current.length > 0) tokens.push(current);
  return tokens.map((t) => t.replace(/^\"|\"$/g, ""));
}

function walkPath(base: unknown, tokens: string[]): unknown {
  let current: unknown = base;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === "*") {
      if (!Array.isArray(current)) return undefined;
      const rest = tokens.slice(i + 1);
      const mapped = current
        .map((item) => walkPath(item, rest))
        .filter((v) => v !== undefined);
      return mapped;
    }

    if (Array.isArray(current)) {
      const idx = parseInt(token, 10);
      if (Number.isNaN(idx)) return undefined;
      current = current[idx];
    } else if (current && typeof current === "object") {
      current = (current as Record<string, unknown>)[token];
    } else {
      return undefined;
    }
  }

  return current;
}

// =============================================================================
// NORMALIZATION
// =============================================================================

function normalizeStatus(
  raw: unknown,
  map?: Record<string, "effective" | "ineffective" | "not-tested">,
): "effective" | "ineffective" | "not-tested" {
  if (raw === undefined || raw === null) return "not-tested";
  const value = String(raw).toLowerCase().trim();

  if (map && map[value]) return map[value];

  switch (value) {
    case "pass":
    case "passed":
    case "ok":
    case "true":
    case "compliant":
    case "effective":
      return "effective";
    case "fail":
    case "failed":
    case "false":
    case "non_compliant":
    case "non-compliant":
    case "ineffective":
      return "ineffective";
    default:
      return "not-tested";
  }
}

function normalizeSeverity(raw: unknown, map?: Record<string, Severity>): Severity | undefined {
  if (raw === undefined || raw === null) return undefined;
  const value = String(raw).toLowerCase().trim();

  if (map && map[value]) return map[value];

  switch (value) {
    case "critical":
      return "CRITICAL";
    case "high":
      return "HIGH";
    case "medium":
      return "MEDIUM";
    case "low":
      return "LOW";
    default:
      return undefined;
  }
}
