/**
 * compliance.txt — Compliance Proof Discovery
 *
 * A discovery layer for compliance proofs, modeled after security.txt (RFC 9116).
 * Organizations publish /.well-known/compliance.txt to advertise their
 * DID identity, CPOE proofs, SCITT log, optional catalog snapshot,
 * and FLAGSHIP signal endpoints.
 *
 * Any agent or human can crawl acme.com/.well-known/compliance.txt and
 * discover everything that org can prove.
 *
 * Origin: @toufik-airane (GitHub issue #2)
 * Spec: https://grcorsair.com/spec/compliance-txt
 *
 * Standard   | Discovery for...
 * ---------- | ----------------
 * robots.txt | Web crawlers
 * security.txt | Vulnerability reporters
 * openid-configuration | Auth clients
 * compliance.txt | Compliance verifiers + agentic audits
 */

import { isBlockedHost } from "../security/url-validation";

// =============================================================================
// TYPES
// =============================================================================

export interface ComplianceTxt {
  /** DID:web identity for signature verification */
  did?: string;

  /** Active CPOE URLs — verifiable compliance proofs */
  cpoes: string[];

  /** SCITT transparency log endpoint for this issuer */
  scitt?: string;

  /** Optional catalog snapshot with per-CPOE metadata */
  catalog?: string;

  /** FLAGSHIP real-time signal stream endpoint */
  flagship?: string;

  /** Compliance frameworks in scope */
  frameworks: string[];

  /** Contact email for compliance inquiries */
  contact?: string;

  /** ISO 8601 expiry date for this compliance.txt */
  expires?: string;
}

export interface ComplianceTxtValidation {
  valid: boolean;
  errors: string[];
}

export interface ComplianceTxtResolution {
  complianceTxt: ComplianceTxt | null;
  error?: string;
}

// =============================================================================
// PARSE
// =============================================================================

/**
 * Parse a compliance.txt string into a structured ComplianceTxt object.
 *
 * Format: KEY: value pairs, one per line. Lines starting with # are comments.
 * CPOE is a repeatable key (multiple entries allowed).
 * Keys are case-insensitive.
 */
export function parseComplianceTxt(input: string): ComplianceTxt {
  const result: ComplianceTxt = {
    cpoes: [],
    frameworks: [],
  };

  const lines = input.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Parse KEY: value
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim().toLowerCase();
    const value = trimmed.slice(colonIndex + 1).trim();

    switch (key) {
      case "did":
        result.did = value;
        break;
      case "cpoe":
        if (value) result.cpoes.push(value);
        break;
      case "scitt":
        result.scitt = value;
        break;
      case "catalog":
        result.catalog = value;
        break;
      case "flagship":
        result.flagship = value;
        break;
      case "frameworks":
        result.frameworks = value
          .split(",")
          .map(f => f.trim())
          .filter(Boolean);
        break;
      case "contact":
        result.contact = value;
        break;
      case "expires":
        result.expires = value;
        break;
      // Unknown keys are silently ignored (forward compatibility)
    }
  }

  return result;
}

// =============================================================================
// GENERATE
// =============================================================================

/**
 * Generate a compliance.txt string from a structured ComplianceTxt object.
 *
 * Includes a header comment with the spec URL for discoverability.
 */
export function generateComplianceTxt(input: ComplianceTxt): string {
  const lines: string[] = [];

  // Header
  lines.push("# Corsair Compliance Discovery");
  lines.push("# Spec: https://grcorsair.com/spec/compliance-txt");
  lines.push("");

  // Identity
  if (input.did) {
    lines.push(`DID: ${input.did}`);
  }

  // Active CPOEs
  if (input.cpoes.length > 0) {
    lines.push("");
    for (const cpoe of input.cpoes) {
      lines.push(`CPOE: ${cpoe}`);
    }
  }

  // Transparency log
  if (input.scitt) {
    lines.push("");
    lines.push(`SCITT: ${input.scitt}`);
  }

  // Catalog snapshot (human-friendly index)
  if (input.catalog) {
    lines.push("");
    lines.push(`CATALOG: ${input.catalog}`);
  }

  // Real-time signals
  if (input.flagship) {
    lines.push("");
    lines.push(`FLAGSHIP: ${input.flagship}`);
  }

  // Frameworks
  if (input.frameworks.length > 0) {
    lines.push("");
    lines.push(`Frameworks: ${input.frameworks.join(", ")}`);
  }

  // Contact
  if (input.contact) {
    lines.push("");
    lines.push(`Contact: ${input.contact}`);
  }

  // Expiry
  if (input.expires) {
    lines.push(`Expires: ${input.expires}`);
  }

  lines.push(""); // trailing newline
  return lines.join("\n");
}

// =============================================================================
// VALIDATE
// =============================================================================

/**
 * Validate a ComplianceTxt object.
 *
 * Checks:
 * - DID is present and starts with "did:web:"
 * - All CPOE URLs are valid HTTPS URLs pointing to public addresses
 * - SCITT/FLAGSHIP URLs are HTTPS
 * - Expires is a valid ISO 8601 date in the future
 */
export function validateComplianceTxt(input: ComplianceTxt): ComplianceTxtValidation {
  const errors: string[] = [];

  // DID is required
  if (!input.did) {
    errors.push("DID is required");
  } else if (!input.did.startsWith("did:web:")) {
    errors.push("DID must start with did:web:");
  }

  // Validate CPOE URLs
  for (let i = 0; i < input.cpoes.length; i++) {
    const cpoe = input.cpoes[i];
    const urlError = validateHttpsUrl(cpoe, `CPOE[${i}]`);
    if (urlError) errors.push(urlError);
  }

  // Validate SCITT URL
  if (input.scitt) {
    const urlError = validateHttpsUrl(input.scitt, "SCITT");
    if (urlError) errors.push(urlError);
  }

  // Validate CATALOG URL
  if (input.catalog) {
    const urlError = validateHttpsUrl(input.catalog, "CATALOG");
    if (urlError) errors.push(urlError);
  }

  // Validate FLAGSHIP URL
  if (input.flagship) {
    const urlError = validateHttpsUrl(input.flagship, "FLAGSHIP");
    if (urlError) errors.push(urlError);
  }

  // Validate Expires
  if (input.expires) {
    const expiresDate = new Date(input.expires);
    if (isNaN(expiresDate.getTime())) {
      errors.push("Expires is not a valid ISO 8601 date");
    } else if (expiresDate.getTime() < Date.now()) {
      errors.push("Expires date has expired");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate that a URL is HTTPS and points to a public address.
 * Returns an error string if invalid, undefined if valid.
 */
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

/**
 * Resolve a domain's compliance.txt by fetching /.well-known/compliance.txt.
 *
 * Includes SSRF protection via isBlockedHost.
 * Accepts an optional fetchFn for testing/mocking.
 */
export async function resolveComplianceTxt(
  domain: string,
  fetchFn?: typeof fetch,
): Promise<ComplianceTxtResolution> {
  // SSRF protection: block private/reserved hosts
  if (isBlockedHost(domain)) {
    return {
      complianceTxt: null,
      error: `Blocked: domain resolves to private/reserved address: ${domain}`,
    };
  }

  const url = `https://${domain}/.well-known/compliance.txt`;

  // Validate constructed URL
  try {
    const urlObj = new URL(url);
    if (isBlockedHost(urlObj.hostname)) {
      return {
        complianceTxt: null,
        error: `Blocked: domain resolves to private/reserved address: ${urlObj.hostname}`,
      };
    }
  } catch {
    return {
      complianceTxt: null,
      error: `Invalid resolution URL: ${url}`,
    };
  }

  const doFetch = fetchFn || globalThis.fetch;

  try {
    const response = await doFetch(url, {
      signal: AbortSignal.timeout(5000),
      redirect: "error",
    });

    if (!response.ok) {
      return {
        complianceTxt: null,
        error: `HTTP ${(response as Response).status}: ${(response as Response).statusText}`,
      };
    }

    const text = await response.text();
    const complianceTxt = parseComplianceTxt(text);

    return { complianceTxt };
  } catch (e) {
    return {
      complianceTxt: null,
      error: `Resolution failed: ${(e as Error).message}`,
    };
  }
}
