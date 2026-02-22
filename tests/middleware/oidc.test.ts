import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { generateKeyPair, SignJWT, exportJWK } from "jose";

import { getOIDCProviders, resetOIDCCacheForTests, verifyOIDCToken } from "../../src/middleware/oidc";

const ISSUER = "https://issuer.example.com";
const AUDIENCE = "corsair-sign";
const JWKS_URL = "https://issuer.example.com/jwks";

let originalFetch: typeof fetch | undefined;
let originalConfig: string | undefined;

async function makeToken(options: {
  privateKey: CryptoKey;
  issuer?: string;
  audience?: string;
  subject?: string;
  includeIat?: boolean;
  iatOffsetSeconds?: number;
  includeJti?: boolean;
  extraClaims?: Record<string, unknown>;
  kid?: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const jwt = new SignJWT(options.extraClaims || {})
    .setProtectedHeader({ alg: "EdDSA", kid: options.kid })
    .setIssuer(options.issuer || ISSUER)
    .setAudience(options.audience || AUDIENCE)
    .setSubject(options.subject || "agent-123")
    .setExpirationTime(now + 3600);

  if (options.includeIat !== false) {
    const iat = now + (options.iatOffsetSeconds || 0);
    jwt.setIssuedAt(iat);
  }

  if (options.includeJti) {
    jwt.setJti("jti-123");
  }

  return jwt.sign(options.privateKey);
}

beforeEach(() => {
  originalFetch = globalThis.fetch;
  originalConfig = process.env.CORSAIR_OIDC_CONFIG;
  resetOIDCCacheForTests();
});

afterEach(() => {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
  }
  if (originalConfig !== undefined) {
    process.env.CORSAIR_OIDC_CONFIG = originalConfig;
  } else {
    delete process.env.CORSAIR_OIDC_CONFIG;
  }
  resetOIDCCacheForTests();
});

describe("OIDC provider config", () => {
  test("parses providers with claim mapping", () => {
    process.env.CORSAIR_OIDC_CONFIG = JSON.stringify({
      providers: [
        {
          issuer: ISSUER,
          audiences: [AUDIENCE],
          claimMapping: { subject: "actor_id", email: "email", organization: "hd" },
          requireJti: true,
        },
        { issuer: "", audiences: [] },
      ],
    });

    const providers = getOIDCProviders();
    expect(providers.length).toBe(1);
    expect(providers[0]!.issuer).toBe(ISSUER);
    expect(providers[0]!.claimMapping?.subject).toBe("actor_id");
    expect(providers[0]!.claimMapping?.email).toBe("email");
    expect(providers[0]!.requireJti).toBe(true);
  });
});

describe("verifyOIDCToken", () => {
  test("returns null when OIDC is not configured", async () => {
    delete process.env.CORSAIR_OIDC_CONFIG;
    const result = await verifyOIDCToken("fake");
    expect(result).toBeNull();
  });

  test("accepts valid token and maps claims", async () => {
    const { publicKey, privateKey } = await generateKeyPair("EdDSA");
    const jwk = await exportJWK(publicKey);
    jwk.kid = "kid-1";

    process.env.CORSAIR_OIDC_CONFIG = JSON.stringify({
      providers: [
        {
          issuer: ISSUER,
          audiences: [AUDIENCE],
          jwksUri: JWKS_URL,
          claimMapping: { subject: "actor_id", email: "email", name: "name" },
        },
      ],
    });

    globalThis.fetch = async (url: string | URL) => {
      if (String(url) === JWKS_URL) {
        return new Response(JSON.stringify({ keys: [jwk] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("not found", { status: 404 });
    };

    const token = await makeToken({
      privateKey,
      kid: "kid-1",
      includeJti: true,
      extraClaims: { actor_id: "agent-999", email: "agent@example.com", name: "Agent Nine" },
    });

    const result = await verifyOIDCToken(token);
    expect(result).toBeTruthy();
    expect(result!.subject).toBe("agent-999");
    expect(result!.identity).toEqual({ subject: "agent-999", email: "agent@example.com", name: "Agent Nine" });
  });

  test("rejects missing iat", async () => {
    const { publicKey, privateKey } = await generateKeyPair("EdDSA");
    const jwk = await exportJWK(publicKey);
    jwk.kid = "kid-2";

    process.env.CORSAIR_OIDC_CONFIG = JSON.stringify({
      providers: [
        { issuer: ISSUER, audiences: [AUDIENCE], jwksUri: JWKS_URL },
      ],
    });

    globalThis.fetch = async () => new Response(JSON.stringify({ keys: [jwk] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

    const token = await makeToken({ privateKey, kid: "kid-2", includeIat: false });
    const result = await verifyOIDCToken(token);
    expect(result).toBeNull();
  });

  test("rejects future iat beyond clock skew", async () => {
    const { publicKey, privateKey } = await generateKeyPair("EdDSA");
    const jwk = await exportJWK(publicKey);
    jwk.kid = "kid-3";

    process.env.CORSAIR_OIDC_CONFIG = JSON.stringify({
      providers: [
        { issuer: ISSUER, audiences: [AUDIENCE], jwksUri: JWKS_URL, clockSkewSeconds: 10 },
      ],
    });

    globalThis.fetch = async () => new Response(JSON.stringify({ keys: [jwk] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

    const token = await makeToken({ privateKey, kid: "kid-3", iatOffsetSeconds: 120 });
    const result = await verifyOIDCToken(token);
    expect(result).toBeNull();
  });

  test("rejects missing jti when required", async () => {
    const { publicKey, privateKey } = await generateKeyPair("EdDSA");
    const jwk = await exportJWK(publicKey);
    jwk.kid = "kid-4";

    process.env.CORSAIR_OIDC_CONFIG = JSON.stringify({
      providers: [
        { issuer: ISSUER, audiences: [AUDIENCE], jwksUri: JWKS_URL, requireJti: true },
      ],
    });

    globalThis.fetch = async () => new Response(JSON.stringify({ keys: [jwk] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

    const token = await makeToken({ privateKey, kid: "kid-4", includeJti: false });
    const result = await verifyOIDCToken(token);
    expect(result).toBeNull();
  });

  test("rejects wrong audience", async () => {
    const { publicKey, privateKey } = await generateKeyPair("EdDSA");
    const jwk = await exportJWK(publicKey);
    jwk.kid = "kid-5";

    process.env.CORSAIR_OIDC_CONFIG = JSON.stringify({
      providers: [
        { issuer: ISSUER, audiences: [AUDIENCE], jwksUri: JWKS_URL },
      ],
    });

    globalThis.fetch = async () => new Response(JSON.stringify({ keys: [jwk] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

    const token = await makeToken({ privateKey, kid: "kid-5", audience: "wrong-aud" });
    const result = await verifyOIDCToken(token);
    expect(result).toBeNull();
  });

  test("discovers JWKS via OIDC discovery", async () => {
    const { publicKey, privateKey } = await generateKeyPair("EdDSA");
    const jwk = await exportJWK(publicKey);
    jwk.kid = "kid-6";

    process.env.CORSAIR_OIDC_CONFIG = JSON.stringify({
      providers: [
        { issuer: ISSUER, audiences: [AUDIENCE] },
      ],
    });

    globalThis.fetch = async (url: string | URL) => {
      if (String(url).endsWith("/.well-known/openid-configuration")) {
        return new Response(JSON.stringify({ jwks_uri: JWKS_URL }), {
          status: 200,
          headers: { "content-type": "application/json", "cache-control": "max-age=3600" },
        });
      }
      if (String(url) === JWKS_URL) {
        return new Response(JSON.stringify({ keys: [jwk] }), {
          status: 200,
          headers: { "content-type": "application/json", "cache-control": "max-age=3600" },
        });
      }
      return new Response("not found", { status: 404 });
    };

    const token = await makeToken({ privateKey, kid: "kid-6", includeJti: true });
    const result = await verifyOIDCToken(token);
    expect(result).toBeTruthy();
    expect(result!.issuer).toBe(ISSUER);
  });
});
