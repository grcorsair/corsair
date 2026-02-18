/**
 * compliance catalog — Human-Friendly Index for CPOEs
 *
 * A JSON snapshot that lists CPOEs with metadata (framework, scope, source, dates, hash).
 * Used to keep trust.txt minimal while still giving humans a digestible index.
 */

import { isBlockedHost } from "../security/url-validation";

// =============================================================================
// TYPES
// =============================================================================

export type ComplianceSource = "tool" | "self" | "auditor" | "unknown";

export interface ComplianceCatalogEntry {
  /** URL to the CPOE (JWT-VC) */
  url: string;
  /** Compliance framework (e.g., SOC2, ISO27001) */
  framework?: string;
  /** Human-readable scope string */
  scope?: string;
  /** Provenance source */
  source?: ComplianceSource;
  /** ISO 8601 issuance timestamp */
  issuedAt?: string;
  /** ISO 8601 expiry timestamp */
  expiresAt?: string;
  /** Hash of the CPOE (sha256:<hex>) */
  hash?: string;
}

export interface ComplianceCatalog {
  /** Catalog schema version */
  version: "1";
  /** Issuer DID (optional) */
  issuer?: string;
  /** ISO 8601 generation timestamp */
  generatedAt?: string;
  /** CPOE entries */
  cpoes: ComplianceCatalogEntry[];
}

export interface ComplianceCatalogValidation {
  valid: boolean;
  errors: string[];
}

export interface ComplianceCatalogResolution {
  catalog: ComplianceCatalog | null;
  error?: string;
}

// =============================================================================
// PARSE
// =============================================================================

export function parseComplianceCatalog(input: string | object): ComplianceCatalog {
  const parsed = typeof input === "string" ? JSON.parse(input) : input;
  const catalog = parsed as ComplianceCatalog;

  return {
    ...catalog,
    cpoes: Array.isArray(catalog.cpoes) ? catalog.cpoes : [],
  };
}

// =============================================================================
// VALIDATE
// =============================================================================

export function validateComplianceCatalog(input: ComplianceCatalog): ComplianceCatalogValidation {
  const errors: string[] = [];

  if (input.version !== "1") {
    errors.push("version must be \"1\"");
  }

  if (input.generatedAt && !isValidDate(input.generatedAt)) {
    errors.push("generatedAt is not a valid ISO 8601 date");
  }

  const allowedSources: ComplianceSource[] = ["tool", "self", "auditor", "unknown"];

  for (let i = 0; i < input.cpoes.length; i++) {
    const entry = input.cpoes[i];
    if (!entry || !entry.url) {
      errors.push(`cpoes[${i}].url is required`);
      continue;
    }

    const urlError = validateHttpsUrl(entry.url, `cpoes[${i}].url`);
    if (urlError) errors.push(urlError);

    if (entry.issuedAt && !isValidDate(entry.issuedAt)) {
      errors.push(`cpoes[${i}].issuedAt is not a valid ISO 8601 date`);
    }

    if (entry.expiresAt && !isValidDate(entry.expiresAt)) {
      errors.push(`cpoes[${i}].expiresAt is not a valid ISO 8601 date`);
    }

    if (entry.source && !allowedSources.includes(entry.source)) {
      errors.push(`cpoes[${i}].source must be one of: ${allowedSources.join(", ")}`);
    }

    if (entry.hash && !/^sha256:[a-fA-F0-9]{64}$/.test(entry.hash)) {
      errors.push(`cpoes[${i}].hash must be sha256:<64 hex chars>`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function isValidDate(value: string): boolean {
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

function validateHttpsUrl(url: string, fieldName: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return `${fieldName}: invalid URL format`;
  }

  if (parsed.protocol !== "https:") {
    return `${fieldName}: must use HTTPS`;
  }

  if (isBlockedHost(parsed.hostname)) {
    return `${fieldName}: Blocked — URL points to private/reserved address: ${parsed.hostname}`;
  }

  return undefined;
}

// =============================================================================
// RESOLVE
// =============================================================================

export async function resolveComplianceCatalog(
  url: string,
  fetchFn?: typeof fetch,
): Promise<ComplianceCatalogResolution> {
  const urlError = validateHttpsUrl(url, "catalog");
  if (urlError) {
    return { catalog: null, error: urlError };
  }

  const doFetch = fetchFn || globalThis.fetch;

  try {
    const response = await doFetch(url, {
      signal: AbortSignal.timeout(5000),
      redirect: "error",
    });

    if (!response.ok) {
      return {
        catalog: null,
        error: `HTTP ${(response as Response).status}: ${(response as Response).statusText}`,
      };
    }

    const text = await response.text();
    const catalog = parseComplianceCatalog(text);

    return { catalog };
  } catch (e) {
    return {
      catalog: null,
      error: `Resolution failed: ${(e as Error).message}`,
    };
  }
}
