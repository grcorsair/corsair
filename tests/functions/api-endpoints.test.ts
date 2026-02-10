import { describe, test, expect, beforeAll } from "bun:test";
import * as crypto from "crypto";
import { importPKCS8, SignJWT } from "jose";

import { createVerifyRouter, type VerifyResponse } from "../../functions/verify";
import { createDIDJsonHandler } from "../../functions/did-json";
import { createJWKSJsonHandler } from "../../functions/jwks-json";
import { createIssueRouter, type IssueRequest, type IssueResponse } from "../../functions/issue";
import { MarqueKeyManager } from "../../src/parley/marque-key-manager";
import type { DIDDocument } from "../../src/parley/did-resolver";

// =============================================================================
// TEST KEY MANAGER (file-based, temp directory)
// =============================================================================

const TEST_KEY_DIR = `/tmp/corsair-test-keys-${Date.now()}`;
const TEST_DOMAIN = "test.grcorsair.com";

let keyManager: MarqueKeyManager;
let testJWT: string;

beforeAll(async () => {
  keyManager = new MarqueKeyManager(TEST_KEY_DIR);
  const keypair = await keyManager.generateKeypair();

  // Generate a test JWT-VC for verification tests
  const privateKey = await importPKCS8(keypair.privateKey.toString(), "EdDSA");
  testJWT = await new SignJWT({
    vc: {
      "@context": ["https://www.w3.org/ns/credentials/v2", "https://grcorsair.com/credentials/cpoe/v1"],
      type: ["VerifiableCredential", "CorsairCPOE"],
      issuer: { id: `did:web:${TEST_DOMAIN}`, name: "Test Issuer" },
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 7 * 86400000).toISOString(),
      credentialSubject: {
        type: "CorsairCPOE",
        scope: "Test scope",
        assurance: { declared: 1, verified: true, method: "self-assessed", breakdown: { "1": 3 } },
        provenance: { source: "tool", sourceIdentity: "Test Tool" },
        summary: { controlsTested: 3, controlsPassed: 3, controlsFailed: 0, overallScore: 100 },
      },
    },
    parley: "2.0",
  })
    .setProtectedHeader({
      alg: "EdDSA",
      typ: "vc+jwt",
      kid: `did:web:${TEST_DOMAIN}#key-1`,
    })
    .setIssuedAt()
    .setIssuer(`did:web:${TEST_DOMAIN}`)
    .setSubject("marque-test-123")
    .setJti("marque-test-123")
    .setExpirationTime(new Date(Date.now() + 7 * 86400000))
    .sign(privateKey);
});

// =============================================================================
// VERIFY ENDPOINT
// =============================================================================

describe("POST /verify", () => {
  test("verifies valid JWT-VC with trusted keys", async () => {
    const router = createVerifyRouter({ keyManager });
    const req = new Request("http://localhost/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cpoe: testJWT }),
    });

    const res = await router(req);
    expect(res.status).toBe(200);

    const body: VerifyResponse = await res.json();
    expect(body.verified).toBe(true);
    expect(body.issuer).toBeTruthy();
    expect(body.assurance).toBeTruthy();
    expect(body.assurance!.level).toBe(1);
    expect(body.summary).toBeTruthy();
    expect(body.summary!.controlsTested).toBe(3);
    expect(body.timestamps.issuedAt).toBeTruthy();
    expect(body.timestamps.expiresAt).toBeTruthy();
  });

  test("returns structured error for invalid JWT", async () => {
    const router = createVerifyRouter({ keyManager });
    const req = new Request("http://localhost/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cpoe: "not.a.valid-jwt" }),
    });

    const res = await router(req);
    expect(res.status).toBe(200);

    const body: VerifyResponse = await res.json();
    expect(body.verified).toBe(false);
  });

  test("rejects missing cpoe field", async () => {
    const router = createVerifyRouter({ keyManager });
    const req = new Request("http://localhost/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wrong: "field" }),
    });

    const res = await router(req);
    expect(res.status).toBe(400);
  });

  test("rejects GET method", async () => {
    const router = createVerifyRouter({ keyManager });
    const req = new Request("http://localhost/verify", { method: "GET" });

    const res = await router(req);
    expect(res.status).toBe(405);
  });

  test("accepts raw JWT string body", async () => {
    const router = createVerifyRouter({ keyManager });
    const req = new Request("http://localhost/verify", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: testJWT,
    });

    const res = await router(req);
    expect(res.status).toBe(200);

    const body: VerifyResponse = await res.json();
    expect(body.verified).toBe(true);
  });

  test("rejects malformed JWT (not 3 segments)", async () => {
    const router = createVerifyRouter({ keyManager });
    const req = new Request("http://localhost/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cpoe: "only.two" }),
    });

    const res = await router(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("three base64url segments");
  });

  test("detects expired JWT-VC", async () => {
    // Create an already-expired JWT
    const keypair = await keyManager.loadKeypair();
    const privateKey = await importPKCS8(keypair!.privateKey.toString(), "EdDSA");
    const expiredJWT = await new SignJWT({
      vc: {
        "@context": ["https://www.w3.org/ns/credentials/v2", "https://grcorsair.com/credentials/cpoe/v1"],
        type: ["VerifiableCredential", "CorsairCPOE"],
        credentialSubject: { type: "CorsairCPOE", scope: "test", assurance: { declared: 0 }, provenance: { source: "self" }, summary: { controlsTested: 1, controlsPassed: 1, controlsFailed: 0, overallScore: 100 } },
      },
      parley: "2.0",
    })
      .setProtectedHeader({ alg: "EdDSA", typ: "vc+jwt", kid: `did:web:${TEST_DOMAIN}#key-1` })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 86400)
      .setIssuer(`did:web:${TEST_DOMAIN}`)
      .setSubject("marque-expired")
      .setJti("marque-expired")
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600) // expired 1 hour ago
      .sign(privateKey);

    const router = createVerifyRouter({ keyManager });
    const req = new Request("http://localhost/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cpoe: expiredJWT }),
    });

    const res = await router(req);
    const body: VerifyResponse = await res.json();
    expect(body.verified).toBe(false);
    expect((body as any).reason).toBe("expired");
  });
});

// =============================================================================
// DID DOCUMENT ENDPOINT
// =============================================================================

describe("GET /.well-known/did.json", () => {
  test("returns valid DID document", async () => {
    const handler = createDIDJsonHandler({ keyManager, domain: TEST_DOMAIN });
    const req = new Request("http://localhost/.well-known/did.json");

    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("did+ld+json");

    const doc: DIDDocument = await res.json();
    expect(doc.id).toBe(`did:web:${TEST_DOMAIN}`);
    expect(doc["@context"]).toContain("https://www.w3.org/ns/did/v1");
    expect(doc.verificationMethod.length).toBeGreaterThan(0);
    expect(doc.verificationMethod[0].type).toBe("JsonWebKey2020");
    expect(doc.verificationMethod[0].publicKeyJwk).toBeTruthy();
    expect(doc.authentication).toContain(`did:web:${TEST_DOMAIN}#key-1`);
    expect(doc.assertionMethod).toContain(`did:web:${TEST_DOMAIN}#key-1`);
  });

  test("sets CORS and cache headers", async () => {
    const handler = createDIDJsonHandler({ keyManager, domain: TEST_DOMAIN });
    const req = new Request("http://localhost/.well-known/did.json");
    const res = await handler(req);

    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("cache-control")).toContain("max-age=3600");
  });
});

// =============================================================================
// JWKS ENDPOINT
// =============================================================================

describe("GET /.well-known/jwks.json", () => {
  test("returns valid JWKS with active key", async () => {
    const handler = createJWKSJsonHandler({ keyManager, domain: TEST_DOMAIN });
    const req = new Request("http://localhost/.well-known/jwks.json");

    const res = await handler(req);
    expect(res.status).toBe(200);

    const jwks: { keys: JsonWebKey[] } = await res.json();
    expect(jwks.keys.length).toBeGreaterThan(0);

    const activeKey = jwks.keys[0];
    expect(activeKey.kty).toBe("OKP");
    expect(activeKey.crv).toBe("Ed25519");
    expect(activeKey.kid).toContain(`did:web:${TEST_DOMAIN}#key-1`);
    expect(activeKey.use).toBe("sig");
    expect(activeKey.alg).toBe("EdDSA");
  });

  test("sets CORS and cache headers", async () => {
    const handler = createJWKSJsonHandler({ keyManager, domain: TEST_DOMAIN });
    const req = new Request("http://localhost/.well-known/jwks.json");
    const res = await handler(req);

    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("cache-control")).toContain("max-age=3600");
  });
});

// =============================================================================
// ISSUE ENDPOINT
// =============================================================================

describe("POST /issue", () => {
  const validIssueBody: IssueRequest = {
    source: "soc2",
    metadata: {
      title: "SOC 2 Type II Report",
      issuer: "Acme Corp",
      date: "2026-01-15",
      scope: "Cloud Infrastructure",
      auditor: "Deloitte LLP",
      reportType: "SOC 2 Type II",
    },
    controls: [
      {
        id: "CC6.1",
        description: "Logical access security",
        status: "effective",
        evidence: "MFA enforced for all user accounts via Okta",
      },
      {
        id: "CC6.2",
        description: "Access provisioning and deprovisioning",
        status: "effective",
        evidence: "Automated provisioning via SCIM integration",
      },
      {
        id: "CC7.1",
        description: "System monitoring",
        status: "ineffective",
        evidence: "Monitoring gaps in staging environment",
      },
    ],
    did: `did:web:${TEST_DOMAIN}`,
  };

  test("issues a valid JWT-VC CPOE", async () => {
    const router = createIssueRouter({ keyManager: keyManager as any, domain: TEST_DOMAIN });
    const req = new Request("http://localhost/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validIssueBody),
    });

    const res = await router(req);
    expect(res.status).toBe(201);

    const body: IssueResponse = await res.json();
    expect(body.cpoe).toBeTruthy();
    expect(body.cpoe.split(".").length).toBe(3); // Valid JWT
    expect(body.marqueId).toContain("marque-");
    expect(body.assurance).toBeTruthy();
    expect(body.provenance.source).toBe("auditor"); // SOC 2 = auditor provenance
    expect(body.expiresAt).toBeTruthy();
  });

  test("issued CPOE verifies successfully", async () => {
    const issueRouter = createIssueRouter({ keyManager: keyManager as any, domain: TEST_DOMAIN });
    const issueReq = new Request("http://localhost/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validIssueBody),
    });

    const issueRes = await issueRouter(issueReq);
    const issueBody: IssueResponse = await issueRes.json();

    // Now verify the issued CPOE
    const verifyRouter = createVerifyRouter({ keyManager });
    const verifyReq = new Request("http://localhost/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cpoe: issueBody.cpoe }),
    });

    const verifyRes = await verifyRouter(verifyReq);
    const verifyBody: VerifyResponse = await verifyRes.json();
    expect(verifyBody.verified).toBe(true);
  });

  test("rejects missing source field", async () => {
    const router = createIssueRouter({ keyManager: keyManager as any, domain: TEST_DOMAIN });
    const req = new Request("http://localhost/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validIssueBody, source: undefined }),
    });

    const res = await router(req);
    expect(res.status).toBe(400);
  });

  test("rejects invalid source type", async () => {
    const router = createIssueRouter({ keyManager: keyManager as any, domain: TEST_DOMAIN });
    const req = new Request("http://localhost/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validIssueBody, source: "invalid" }),
    });

    const res = await router(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid source");
  });

  test("rejects empty controls array", async () => {
    const router = createIssueRouter({ keyManager: keyManager as any, domain: TEST_DOMAIN });
    const req = new Request("http://localhost/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validIssueBody, controls: [] }),
    });

    const res = await router(req);
    expect(res.status).toBe(400);
  });

  test("rejects missing metadata fields", async () => {
    const router = createIssueRouter({ keyManager: keyManager as any, domain: TEST_DOMAIN });
    const req = new Request("http://localhost/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validIssueBody, metadata: { title: "only title" } }),
    });

    const res = await router(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("metadata.issuer");
  });

  test("rejects GET method", async () => {
    const router = createIssueRouter({ keyManager: keyManager as any, domain: TEST_DOMAIN });
    const req = new Request("http://localhost/issue", { method: "GET" });

    const res = await router(req);
    expect(res.status).toBe(405);
  });

  test("accepts manual source for L0 issuance", async () => {
    const router = createIssueRouter({ keyManager: keyManager as any, domain: TEST_DOMAIN });
    const req = new Request("http://localhost/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...validIssueBody,
        source: "manual",
        metadata: { ...validIssueBody.metadata, auditor: undefined },
        controls: [{
          id: "CC6.1",
          description: "Logical access security",
          status: "effective",
          evidence: "Self-reported: MFA is enabled",
        }],
      }),
    });

    const res = await router(req);
    expect(res.status).toBe(201);

    const body: IssueResponse = await res.json();
    expect(body.assurance.declared).toBe(0); // Manual = L0
    expect(body.provenance.source).toBe("self"); // Manual = self
  });
});
