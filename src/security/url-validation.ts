/**
 * URL Validation — SSRF Protection
 *
 * Blocks requests to private, reserved, and metadata service addresses.
 * Used by DID resolver and SSF endpoint URL validation to prevent
 * Server-Side Request Forgery attacks.
 */

/**
 * Check if a hostname resolves to a private, reserved, or otherwise
 * blocked address that should not be reachable from server-side fetches.
 *
 * Blocks:
 * - IPv4 private ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
 * - Loopback: 127.0.0.0/8
 * - Link-local: 169.254.0.0/16
 * - Null: 0.0.0.0/8
 * - IPv6 equivalents: ::1, fc00::/7, fe80::/10
 * - Cloud metadata hostnames: metadata.google.internal, metadata.internal
 * - localhost (any case)
 */
export function isBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  // Block localhost variants
  if (lower === "localhost" || lower.endsWith(".localhost")) return true;

  // Block cloud metadata service hostnames
  if (lower === "metadata.google.internal" || lower === "metadata.internal") {
    return true;
  }

  // Strip brackets from IPv6 addresses
  const host = lower.startsWith("[") && lower.endsWith("]")
    ? lower.slice(1, -1)
    : lower;

  // IPv4 checks
  const ipv4Match = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const a = Number(ipv4Match[1]);
    const b = Number(ipv4Match[2]);
    if (a === 0) return true;                           // 0.0.0.0/8
    if (a === 10) return true;                          // 10.0.0.0/8
    if (a === 127) return true;                         // 127.0.0.0/8
    if (a === 169 && b === 254) return true;            // 169.254.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
    if (a === 192 && b === 168) return true;             // 192.168.0.0/16
  }

  // IPv6 checks
  if (host === "::1") return true;                              // loopback
  if (host.startsWith("fc") || host.startsWith("fd")) return true; // fc00::/7 (unique local)
  if (host.startsWith("fe8") || host.startsWith("fe9") ||
      host.startsWith("fea") || host.startsWith("feb")) return true; // fe80::/10 (link-local)

  return false;
}

/**
 * Validate that a URL is safe for server-side fetching.
 * Returns { valid: true } if safe, or { valid: false, error: "..." } if blocked.
 */
export function validatePublicUrl(url: string): { valid: boolean; error?: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { valid: false, error: "URL must use http or https protocol" };
  }

  if (isBlockedHost(parsed.hostname)) {
    return { valid: false, error: `Blocked: URL points to private/reserved address: ${parsed.hostname}` };
  }

  return { valid: true };
}
