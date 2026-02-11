/**
 * URL Validation — SSRF Protection Tests
 *
 * Verifies that private, reserved, and metadata service addresses are blocked
 * while legitimate public URLs are allowed through.
 */

import { describe, test, expect } from "bun:test";
import { isBlockedHost, validatePublicUrl } from "../../src/security/url-validation";

describe("isBlockedHost", () => {
  // =========================================================================
  // BLOCKED ADDRESSES
  // =========================================================================

  describe("blocks private IPv4 ranges", () => {
    test("blocks 10.0.0.0/8", () => {
      expect(isBlockedHost("10.0.0.1")).toBe(true);
      expect(isBlockedHost("10.255.255.255")).toBe(true);
    });

    test("blocks 172.16.0.0/12", () => {
      expect(isBlockedHost("172.16.0.1")).toBe(true);
      expect(isBlockedHost("172.31.255.255")).toBe(true);
    });

    test("blocks 192.168.0.0/16", () => {
      expect(isBlockedHost("192.168.1.1")).toBe(true);
      expect(isBlockedHost("192.168.0.1")).toBe(true);
    });
  });

  describe("blocks loopback", () => {
    test("blocks 127.0.0.0/8", () => {
      expect(isBlockedHost("127.0.0.1")).toBe(true);
      expect(isBlockedHost("127.255.255.255")).toBe(true);
    });
  });

  describe("blocks link-local", () => {
    test("blocks 169.254.0.0/16 (AWS/GCP metadata)", () => {
      expect(isBlockedHost("169.254.169.254")).toBe(true);
      expect(isBlockedHost("169.254.0.1")).toBe(true);
    });
  });

  describe("blocks null range", () => {
    test("blocks 0.0.0.0/8", () => {
      expect(isBlockedHost("0.0.0.0")).toBe(true);
      expect(isBlockedHost("0.0.0.1")).toBe(true);
    });
  });

  describe("blocks localhost", () => {
    test("blocks localhost", () => {
      expect(isBlockedHost("localhost")).toBe(true);
    });

    test("blocks LOCALHOST (case-insensitive)", () => {
      expect(isBlockedHost("LOCALHOST")).toBe(true);
    });

    test("blocks subdomain of localhost", () => {
      expect(isBlockedHost("foo.localhost")).toBe(true);
    });
  });

  describe("blocks metadata service hostnames", () => {
    test("blocks metadata.google.internal", () => {
      expect(isBlockedHost("metadata.google.internal")).toBe(true);
    });

    test("blocks metadata.internal", () => {
      expect(isBlockedHost("metadata.internal")).toBe(true);
    });
  });

  describe("blocks IPv6 reserved addresses", () => {
    test("blocks ::1 (loopback)", () => {
      expect(isBlockedHost("::1")).toBe(true);
      expect(isBlockedHost("[::1]")).toBe(true);
    });

    test("blocks fc00::/7 (unique local)", () => {
      expect(isBlockedHost("fc00::1")).toBe(true);
      expect(isBlockedHost("fd00::1")).toBe(true);
    });

    test("blocks fe80::/10 (link-local)", () => {
      expect(isBlockedHost("fe80::1")).toBe(true);
    });
  });

  // =========================================================================
  // ALLOWED ADDRESSES
  // =========================================================================

  describe("allows public addresses", () => {
    test("allows public domains", () => {
      expect(isBlockedHost("grcorsair.com")).toBe(false);
      expect(isBlockedHost("example.com")).toBe(false);
      expect(isBlockedHost("api.github.com")).toBe(false);
    });

    test("allows public IPv4", () => {
      expect(isBlockedHost("8.8.8.8")).toBe(false);
      expect(isBlockedHost("1.1.1.1")).toBe(false);
    });

    test("does not block 172.15.x.x (outside /12 range)", () => {
      expect(isBlockedHost("172.15.255.255")).toBe(false);
    });

    test("does not block 172.32.x.x (outside /12 range)", () => {
      expect(isBlockedHost("172.32.0.1")).toBe(false);
    });
  });
});

describe("validatePublicUrl", () => {
  test("allows https URLs to public hosts", () => {
    const result = validatePublicUrl("https://grcorsair.com/.well-known/did.json");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test("allows http URLs to public hosts", () => {
    const result = validatePublicUrl("http://example.com/events");
    expect(result.valid).toBe(true);
  });

  test("rejects invalid URL format", () => {
    const result = validatePublicUrl("not a url");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid URL");
  });

  test("rejects non-http(s) protocols", () => {
    const result = validatePublicUrl("ftp://example.com/file");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("http or https");
  });

  test("rejects private IP addresses", () => {
    const result = validatePublicUrl("http://169.254.169.254/latest/meta-data/");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("private/reserved");
  });

  test("rejects localhost URLs", () => {
    const result = validatePublicUrl("http://localhost:3000/admin");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("private/reserved");
  });

  test("rejects metadata service URLs", () => {
    const result = validatePublicUrl("http://metadata.google.internal/computeMetadata/v1/");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("private/reserved");
  });
});
