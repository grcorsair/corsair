import { describe, test, expect } from "bun:test";

import {
  createHostedTrustTxtRouter,
  createHostedTrustTxtPublicHandler,
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

function getRequest(path: string): Request {
  return new Request(`http://localhost${path}`, {
    method: "GET",
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

  test("allows updates from a different owner while pending", async () => {
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
    expect(updateRes.status).toBe(200);
  });

  test("allows replacing pending claims by a different owner", async () => {
    const store = createMemoryHostedTrustTxtStore();
    const router = createHostedTrustTxtRouter({ store, trustHost: TRUST_HOST });

    const createReq = withApiKey(jsonRequest("/trust-txt/host", {
      domain: "acme.com",
    }), "key-1");
    const createRes = await router(createReq);
    expect(createRes.status).toBe(200);

    const takeoverReq = withApiKey(jsonRequest("/trust-txt/host", {
      domain: "acme.com",
      contact: "security@acme.com",
    }), "key-2");
    const takeoverRes = await router(takeoverReq);
    expect(takeoverRes.status).toBe(200);

    const owner2GetReq = withApiKey(getRequest("/trust-txt/host/acme.com"), "key-2");
    const owner2GetRes = await router(owner2GetReq);
    expect(owner2GetRes.status).toBe(200);
  });

  test("rejects replacing active claims by a different owner", async () => {
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

    const createReq = withApiKey(jsonRequest("/trust-txt/host", { domain: "acme.com" }), "key-1");
    const createRes = await router(createReq);
    expect(createRes.status).toBe(200);

    const verifyReq = withApiKey(jsonRequest("/trust-txt/host/acme.com/verify", {}), "key-1");
    const verifyRes = await router(verifyReq);
    expect(verifyRes.status).toBe(200);

    const takeoverReq = withApiKey(jsonRequest("/trust-txt/host", {
      domain: "acme.com",
      contact: "security@acme.com",
    }), "key-2");
    const takeoverRes = await router(takeoverReq);
    expect(takeoverRes.status).toBe(403);
  });

  test("is idempotent when request payload does not change", async () => {
    const store = createMemoryHostedTrustTxtStore();
    const router = createHostedTrustTxtRouter({ store, trustHost: TRUST_HOST });

    const req1 = withApiKey(jsonRequest("/trust-txt/host", {
      domain: "acme.com",
    }), "key-1");
    const res1 = await router(req1);
    expect(res1.status).toBe(200);
    const body1 = (await res1.json()) as HostedTrustTxtResponse;

    await new Promise((resolve) => setTimeout(resolve, 5));

    const req2 = withApiKey(jsonRequest("/trust-txt/host", {
      domain: "acme.com",
    }), "key-1");
    const res2 = await router(req2);
    expect(res2.status).toBe(200);
    const body2 = (await res2.json()) as HostedTrustTxtResponse;

    expect(body2.trustTxt.hash).toBe(body1.trustTxt.hash);
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

  test("accepts equivalent delegated URLs during verification", async () => {
    const store = createMemoryHostedTrustTxtStore();
    const router = createHostedTrustTxtRouter({
      store,
      trustHost: TRUST_HOST,
      resolveTrustTxt: async (domain: string) => ({
        trustTxt: { did: `did:web:${domain}`, cpoes: [], frameworks: [] },
        source: "delegated-txt",
        url: `https://${TRUST_HOST.toUpperCase()}:443/trust/${domain}/trust.txt/`,
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
    const body = (await verifyRes.json()) as { status: string };
    expect(body.status).toBe("active");
  });

  test("emits journal events for upsert and verify", async () => {
    const events: Array<{ eventType: string; targetId?: string }> = [];
    const store = createMemoryHostedTrustTxtStore();
    const router = createHostedTrustTxtRouter({
      store,
      trustHost: TRUST_HOST,
      eventJournal: {
        async write(entry) {
          events.push(entry);
        },
      },
      resolveTrustTxt: async (domain: string) => ({
        trustTxt: { did: `did:web:${domain}`, cpoes: [], frameworks: [] },
        source: "delegated-txt",
        url: `https://${TRUST_HOST}/trust/${domain}/trust.txt`,
        delegated: { method: "txt", hashPinned: true, hashValid: true },
      }),
    });

    const createReq = withApiKey(jsonRequest("/trust-txt/host", { domain: "acme.com" }), "key-1");
    const createRes = await router(createReq);
    expect(createRes.status).toBe(200);

    const verifyReq = withApiKey(jsonRequest("/trust-txt/host/acme.com/verify", {}), "key-1");
    const verifyRes = await router(verifyReq);
    expect(verifyRes.status).toBe(200);

    expect(events.map((e) => e.eventType)).toEqual([
      "trusttxt.hosted.upsert",
      "trusttxt.hosted.verified",
    ]);
    expect(events.every((e) => e.targetId === "acme.com")).toBe(true);
  });

  test("emits journal event for public hosted trust.txt fetch", async () => {
    const events: Array<{ eventType: string; targetId?: string }> = [];
    const store = createMemoryHostedTrustTxtStore();
    const router = createHostedTrustTxtRouter({ store, trustHost: TRUST_HOST });
    const publicHandler = createHostedTrustTxtPublicHandler({
      store,
      eventJournal: {
        async write(entry) {
          events.push(entry);
        },
      },
    });

    const createReq = withApiKey(jsonRequest("/trust-txt/host", { domain: "acme.com" }), "key-1");
    const createRes = await router(createReq);
    expect(createRes.status).toBe(200);

    const publicRes = await publicHandler(getRequest("/trust/acme.com/trust.txt"));
    expect(publicRes.status).toBe(200);
    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe("trusttxt.hosted.public_fetch");
    expect(events[0].targetId).toBe("acme.com");
  });
});
