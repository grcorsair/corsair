/**
 * Sign Privacy Integration Tests
 *
 * Full pipeline tests for SD-JWT selective disclosure + sanitization.
 * Validates: SD-JWT issuance, sanitization interop, selective presentation,
 * and JSON output with disclosures.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { signEvidence } from "../../src/sign/sign-core";
import { MarqueKeyManager } from "../../src/parley/marque-key-manager";
import {
  verifySDJWT,
  presentSDJWT,
  parseSDJWT,
} from "../../src/parley/sd-jwt";

// =============================================================================
// SETUP
// =============================================================================

const tmpDir = join(import.meta.dir, ".tmp-sign-privacy-integration");
let keyManager: MarqueKeyManager;
let publicKeyJwk: JsonWebKey;

beforeAll(async () => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });

  keyManager = new MarqueKeyManager(join(tmpDir, "keys"));
  await keyManager.generateKeypair();

  // Export public key as JWK for verification
  publicKeyJwk = await keyManager.exportJWK();
});

afterAll(() => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
});

// =============================================================================
// SAMPLE DATA
// =============================================================================

const genericEvidence = {
  metadata: {
    title: "Privacy Pipeline Test Assessment",
    issuer: "Acme Security Corp",
    date: "2026-02-14",
    scope: "AWS Production Infrastructure",
  },
  controls: [
    {
      id: "MFA-001",
      description: "MFA enabled for all users",
      status: "pass",
      evidence: "Okta SSO configuration verified",
      framework: "NIST-800-53",
      controlId: "IA-2",
    },
    {
      id: "ENC-001",
      description: "Encryption at rest for S3",
      status: "pass",
      evidence: "AES-256 enabled on all buckets",
    },
    {
      id: "LOG-001",
      description: "Audit logging active",
      status: "fail",
      severity: "HIGH",
      evidence: "CloudTrail disabled in us-west-2",
    },
  ],
};

/** Evidence containing ARN-like strings and IP addresses for sanitization test */
const sensitiveEvidence = {
  metadata: {
    title: "Sensitive Evidence Test",
    issuer: "Acme Corp",
    date: "2026-02-14",
    scope: "AWS Production",
  },
  controls: [
    {
      id: "NET-001",
      description: "Network segmentation verified at 10.0.1.42",
      status: "pass",
      evidence:
        "Verified via arn:aws:ec2:us-east-1:123456789012:vpc/vpc-abc123 at IP 192.168.1.100",
    },
    {
      id: "IAM-001",
      description: "IAM role arn:aws:iam::123456789012:role/admin restricted",
      status: "pass",
      evidence: "Access from 172.16.0.5 blocked by security group",
    },
  ],
};

// =============================================================================
// TEST 1: sign --sd-jwt produces verifiable SD-JWT
// =============================================================================

describe("Privacy Pipeline Integration", () => {
  test("sign --sd-jwt produces verifiable SD-JWT", async () => {
    const result = await signEvidence(
      {
        evidence: genericEvidence,
        sdJwt: true,
        sdFields: ["summary", "frameworks"],
      },
      keyManager,
    );

    // Output must contain ~ separator (SD-JWT format)
    expect(result.jwt).toContain("~");

    // Parse the SD-JWT to confirm structure
    const parsed = parseSDJWT(result.jwt);
    expect(parsed.jwt).toBeTruthy();
    expect(parsed.disclosures.length).toBeGreaterThan(0);

    // Verify the SD-JWT against the signing key's public JWK
    const verification = await verifySDJWT(result.jwt, publicKeyJwk);
    expect(verification.valid).toBe(true);

    // Disclosed claims should include the fields we made disclosable
    // (they are included as disclosures appended to the SD-JWT)
    expect(verification.disclosedClaims).toHaveProperty("summary");

    // Payload should exist and contain vc
    expect(verification.payload).toBeDefined();
    expect(verification.payload!.vc).toBeDefined();
  });

  // ===========================================================================
  // TEST 2: SD-JWT + sanitization work together
  // ===========================================================================

  test("SD-JWT + sanitization work together", async () => {
    const result = await signEvidence(
      {
        evidence: sensitiveEvidence,
        sdJwt: true,
        sdFields: ["summary", "frameworks"],
      },
      keyManager,
    );

    // Must be SD-JWT format
    expect(result.jwt).toContain("~");

    // Verify it is a valid SD-JWT
    const verification = await verifySDJWT(result.jwt, publicKeyJwk);
    expect(verification.valid).toBe(true);

    // Decode the JWT portion to inspect the credential subject
    const jwtPart = result.jwt.split("~")[0];
    const payloadB64 = jwtPart.split(".")[1];
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf-8"),
    );
    const credSubject = payload.vc?.credentialSubject;

    // Serialize the entire credential subject to check for sensitive data
    const subjectJson = JSON.stringify(credSubject);

    // No raw IP addresses should appear in the JWT payload
    expect(subjectJson).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);

    // No raw ARNs should appear
    expect(subjectJson).not.toContain("arn:aws:");

    // Also check the disclosures for sanitization
    // Disclosures contain the actual values (summary, frameworks) which
    // should also have been sanitized before SD-JWT wrapping
    if (result.disclosures && result.disclosures.length > 0) {
      for (const d of result.disclosures) {
        const decoded = JSON.parse(
          Buffer.from(d.disclosure, "base64url").toString("utf-8"),
        );
        const disclosureJson = JSON.stringify(decoded);
        // Disclosure values should also be sanitized
        expect(disclosureJson).not.toContain("arn:aws:");
      }
    }
  });

  // ===========================================================================
  // TEST 3: SD-JWT roundtrip: sign -> present -> verify
  // ===========================================================================

  test("SD-JWT roundtrip: sign -> present -> verify", async () => {
    const result = await signEvidence(
      {
        evidence: genericEvidence,
        sdJwt: true,
        sdFields: ["summary", "frameworks"],
      },
      keyManager,
    );

    expect(result.disclosures).toBeDefined();
    expect(result.disclosures!.length).toBeGreaterThan(0);

    // Create a presentation that only reveals "summary"
    const presentation = presentSDJWT(
      result.jwt,
      result.disclosures!,
      ["summary"],
    );

    // Presentation should still contain ~ (at least the summary disclosure)
    expect(presentation).toContain("~");

    // Verify the presentation
    const verification = await verifySDJWT(presentation, publicKeyJwk);
    expect(verification.valid).toBe(true);

    // "summary" should be disclosed
    expect(verification.disclosedClaims).toHaveProperty("summary");
    const summary = verification.disclosedClaims.summary as Record<
      string,
      unknown
    >;
    expect(summary).toHaveProperty("controlsTested");
    expect(summary).toHaveProperty("controlsPassed");
    expect(summary).toHaveProperty("controlsFailed");
    expect(summary).toHaveProperty("overallScore");

    // "frameworks" should NOT be disclosed (remains as hash in _sd)
    expect(verification.disclosedClaims).not.toHaveProperty("frameworks");

    // There should be undisclosed digests for the non-revealed fields
    // (frameworks, if it was present in the original credential subject)
    const frameworksDisclosure = result.disclosures!.find(
      (d) => d.claim === "frameworks",
    );
    if (frameworksDisclosure) {
      expect(verification.undisclosedDigests.length).toBeGreaterThan(0);
      expect(verification.undisclosedDigests).toContain(
        frameworksDisclosure.digest,
      );
    }
  });

  // ===========================================================================
  // TEST 4: sign --sd-jwt --json includes disclosures
  // ===========================================================================

  test("sign --sd-jwt --json includes disclosures", async () => {
    const result = await signEvidence(
      {
        evidence: genericEvidence,
        sdJwt: true,
        sdFields: ["summary", "frameworks"],
      },
      keyManager,
    );

    // The output should include a disclosures array
    expect(result.disclosures).toBeDefined();
    expect(Array.isArray(result.disclosures)).toBe(true);
    expect(result.disclosures!.length).toBeGreaterThan(0);

    // Each disclosure entry should have claim, disclosure, and digest
    for (const d of result.disclosures!) {
      expect(typeof d.claim).toBe("string");
      expect(d.claim.length).toBeGreaterThan(0);

      expect(typeof d.disclosure).toBe("string");
      expect(d.disclosure.length).toBeGreaterThan(0);

      expect(typeof d.digest).toBe("string");
      expect(d.digest.length).toBeGreaterThan(0);
    }

    // Verify the claim names match what we requested
    const claimNames = result.disclosures!.map((d) => d.claim);
    expect(claimNames).toContain("summary");

    // Simulate JSON output structure (what --json would produce)
    const jsonOutput: Record<string, unknown> = {
      cpoe: result.jwt,
      marqueId: result.marqueId,
      detectedFormat: result.detectedFormat,
      summary: result.summary,
      provenance: result.provenance,
      warnings: result.warnings,
    };
    if (result.disclosures) {
      jsonOutput.disclosures = result.disclosures;
    }

    // Parse it back to verify JSON roundtrip
    const parsed = JSON.parse(JSON.stringify(jsonOutput));
    expect(parsed.disclosures).toBeDefined();
    expect(Array.isArray(parsed.disclosures)).toBe(true);
    expect(parsed.disclosures.length).toBe(result.disclosures!.length);

    // Verify each disclosure can be base64url-decoded
    for (const d of parsed.disclosures) {
      const decoded = JSON.parse(
        Buffer.from(d.disclosure, "base64url").toString("utf-8"),
      );
      expect(Array.isArray(decoded)).toBe(true);
      expect(decoded.length).toBe(3); // [salt, claim_name, claim_value]
      expect(decoded[1]).toBe(d.claim);
    }
  });
});
