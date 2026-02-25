import { describe, test, expect } from "bun:test";

import {
  createHostedTrustTxtRouter,
  type HostedTrustTxtResponse,
} from "../../functions/hosted-trust-txt";
import { createMemoryHostedTrustTxtStore } from "../../src/parley/hosted-trust-store";

const TRUST_HOST = "trust.example.com";

function jsonRequest(path: string, body: Record<string, unknown>): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function withApiKey(req: Request, key: string): Request {
  (req as Request & { corsairAuth?: unknown }).corsairAuth = { type: "api_key", key };
  return req;
}

describe("hosted trust.txt", () => {
  test("creates hosted trust.txt and returns DNS records", async () => {
    const store = createMemoryHostedTrustTxtStore();
    const router = createHostedTrustTxtRouter({ store, trustHost: TRUST_HOST });

    const req = withApiKey(jsonRequest("/trust-txt/host", {
      domain: "acme.com",
      cpoes: ["https://acme.com/compliance/soc2.jwt"],
    }), "key-1");

    const res = await router(req);
    expect(res.status).toBe(200);

    const body = (await res.json()) as HostedTrustTxtResponse;
    expect(body.domain).toBe("acme.com");
    expect(body.did).toBe("did:web:acme.com");
    expect(body.urls.hosted).toBe(`https://${TRUST_HOST}/trust/acme.com/trust.txt`);
    expect(body.trustTxt.content).toContain("DID: did:web:acme.com");
    expect(body.dns.txt).toContain("_corsair.acme.com");
    expect(body.dns.txt).toContain(body.urls.hosted);
    expect(body.dns.hashTxt).toContain(body.trustTxt.hash);
  });

  test("rejects invalid domain", async () => {
    const store = createMemoryHostedTrustTxtStore();
    const router = createHostedTrustTxtRouter({ store, trustHost: TRUST_HOST });

    const req = withApiKey(jsonRequest("/trust-txt/host", {
      domain: "bad domain",
    }), "key-1");

    const res = await router(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid domain");
  });

  test("rejects updates from a different owner", async () => {
    const store = createMemoryHostedTrustTxtStore();
    const router = createHostedTrustTxtRouter({ store, trustHost: TRUST_HOST });

    const createReq = withApiKey(jsonRequest("/trust-txt/host", {
      domain: "acme.com",
    }), "key-1");
    const createRes = await router(createReq);
    expect(createRes.status).toBe(200);

    const updateReq = withApiKey(jsonRequest("/trust-txt/host", {
      domain: "acme.com",
      contact: "security@acme.com",
    }), "key-2");

    const updateRes = await router(updateReq);
    expect(updateRes.status).toBe(403);
    const body = await updateRes.json();
    expect(body.error).toContain("owner");
  });

  test("verifies DNS delegation and activates hosted trust.txt", async () => {
    const store = createMemoryHostedTrustTxtStore();
    const router = createHostedTrustTxtRouter({
      store,
      trustHost: TRUST_HOST,
      resolveTrustTxt: async (domain: string) => ({
        trustTxt: { did: `did:web:${domain}`, cpoes: [], frameworks: [] },
        source: "delegated-txt",
        url: `https://${TRUST_HOST}/trust/${domain}/trust.txt`,
        delegated: { method: "txt", hashPinned: true, hashValid: true },
      }),
    });

    const createReq = withApiKey(jsonRequest("/trust-txt/host", {
      domain: "acme.com",
    }), "key-1");
    const createRes = await router(createReq);
    expect(createRes.status).toBe(200);

    const verifyReq = withApiKey(jsonRequest("/trust-txt/host/acme.com/verify", {}), "key-1");
    const verifyRes = await router(verifyReq);
    expect(verifyRes.status).toBe(200);

    const body = (await verifyRes.json()) as { status: string; verifiedAt?: string };
    expect(body.status).toBe("active");
    expect(body.verifiedAt).toBeTruthy();
  });
});
