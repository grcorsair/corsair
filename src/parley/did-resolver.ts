/**
 * DID Resolver - did:web Resolution for Parley
 *
 * Implements DID:web method parsing, formatting, and resolution
 * per the DID:web specification (https://w3c-ccg.github.io/did-method-web/).
 *
 * did:web DIDs resolve to DID Documents hosted at well-known HTTPS URLs.
 * Resolution: did:web:example.com → https://example.com/.well-known/did.json
 * With path:  did:web:example.com:path:to → https://example.com/path/to/did.json
 */

import { isBlockedHost } from "../security/url-validation";

// =============================================================================
// DID DOCUMENT TYPES
// =============================================================================

export interface DIDDocument {
  /** JSON-LD context */
  "@context": string[];

  /** The DID this document describes */
  id: string;

  /** Verification methods (public keys) */
  verificationMethod: VerificationMethod[];

  /** DIDs/key IDs authorized for authentication */
  authentication: string[];

  /** DIDs/key IDs authorized for making assertions */
  assertionMethod: string[];
}

export interface VerificationMethod {
  /** Key identifier (e.g., "did:web:grcorsair.com#key-1") */
  id: string;

  /** Key type */
  type: "JsonWebKey2020";

  /** DID of the controller */
  controller: string;

  /** Public key in JWK format */
  publicKeyJwk: JsonWebKey;
}

export interface DIDResolutionResult {
  /** Resolved DID document, or null on failure */
  didDocument: DIDDocument | null;

  /** Resolution metadata (contains error if failed) */
  didResolutionMetadata: { error?: string };

  /** Document metadata */
  didDocumentMetadata: Record<string, unknown>;
}

// =============================================================================
// PARSE / FORMAT UTILITIES
// =============================================================================

/**
 * Parse a did:web DID URI into domain and optional path components.
 *
 * did:web:example.com           → { domain: "example.com" }
 * did:web:example.com:users:bob → { domain: "example.com", path: "users/bob" }
 * did:web:localhost%3A3000      → { domain: "localhost:3000" }
 */
export function parseDIDWeb(did: string): { domain: string; path?: string } {
  if (!did.startsWith("did:web:")) {
    throw new Error(`Invalid DID:web URI: must start with "did:web:", got "${did}"`);
  }

  const remainder = did.slice("did:web:".length);
  if (!remainder) {
    throw new Error("Invalid DID:web URI: empty domain");
  }

  const segments = remainder.split(":");
  const domain = decodeURIComponent(segments[0]);

  if (segments.length === 1) {
    return { domain };
  }

  const pathSegments = segments.slice(1);
  return { domain, path: pathSegments.join("/") };
}

/**
 * Format a domain and optional path into a did:web DID URI.
 *
 * ("example.com")                → "did:web:example.com"
 * ("example.com", "users/bob")   → "did:web:example.com:users:bob"
 * ("localhost:3000")             → "did:web:localhost%3A3000"
 */
export function formatDIDWeb(domain: string, path?: string): string {
  const encodedDomain = domain.replace(/:/g, "%3A");

  if (!path) {
    return `did:web:${encodedDomain}`;
  }

  const pathSegments = path.split("/").join(":");
  return `did:web:${encodedDomain}:${pathSegments}`;
}

// =============================================================================
// RESOLUTION
// =============================================================================

/**
 * Resolve a did:web DID to its DID Document via HTTPS.
 *
 * For did:web:example.com → fetches https://example.com/.well-known/did.json
 * For did:web:example.com:path:to → fetches https://example.com/path/to/did.json
 *
 * Accepts an optional fetchFn for testing/mocking.
 */
export async function resolveDIDDocument(
  did: string,
  fetchFn?: typeof fetch,
): Promise<DIDResolutionResult> {
  const emptyResult = (error: string): DIDResolutionResult => ({
    didDocument: null,
    didResolutionMetadata: { error },
    didDocumentMetadata: {},
  });

  let parsed: { domain: string; path?: string };
  try {
    parsed = parseDIDWeb(did);
  } catch (e) {
    return emptyResult((e as Error).message);
  }

  // Construct HTTPS URL per did:web spec
  let url: string;
  if (parsed.path) {
    url = `https://${parsed.domain}/${parsed.path}/did.json`;
  } else {
    url = `https://${parsed.domain}/.well-known/did.json`;
  }

  // SSRF protection: block private/reserved hosts
  try {
    const urlObj = new URL(url);
    if (isBlockedHost(urlObj.hostname)) {
      return emptyResult(`Blocked: DID resolves to private/reserved address: ${urlObj.hostname}`);
    }
  } catch {
    return emptyResult(`Invalid resolution URL: ${url}`);
  }

  const doFetch = fetchFn || globalThis.fetch;

  try {
    const response = await doFetch(url, { signal: AbortSignal.timeout(5000), redirect: "error" });
    if (!response.ok) {
      return emptyResult(`HTTP ${(response as Response).status}: ${(response as Response).statusText}`);
    }

    const didDocument: DIDDocument = await response.json();
    return {
      didDocument,
      didResolutionMetadata: {},
      didDocumentMetadata: {},
    };
  } catch (e) {
    return emptyResult(`Resolution failed: ${(e as Error).message}`);
  }
}
