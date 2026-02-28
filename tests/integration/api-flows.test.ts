import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { createHostedTrustTxtRouter, createHostedTrustTxtPublicHandler } from "../../functions/hosted-trust-txt";
import { createIssueRouter } from "../../functions/issue";
import { createSignRouter } from "../../functions/sign";
import { createVerifyRouter } from "../../functions/verify";
import { MarqueKeyManager } from "../../src/parley/marque-key-manager";
import { createMemoryHostedTrustTxtStore } from "../../src/parley/hosted-trust-store";

const tmpDir = join(import.meta.dir, ".tmp-api-flows");
const didDomain = "integration.grcorsair.test";
const trustHost = "trust.integration.grcorsair.test";

let keyManager: MarqueKeyManager;

beforeAll(async () => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });
  keyManager = new MarqueKeyManager(join(tmpDir, "keys"));
  await keyManager.generateKeypair();
});

afterAll(() => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
});

function postJson(path: string, body: unknown, headers?: Record<string, string>): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(headers || {}),
    },
    body: JSON.stringify(body),
  });
}

function withApiKey(req: Request, key: string): Request {
  (req as Request & { corsairAuth?: unknown }).corsairAuth = { type: "api_key", key };
  return req;
}

describe("integration api flows", () => {
  test("sign -> verify flow succeeds end-to-end", async () => {
    const signRouter = createSignRouter({ keyManager, domain: didDomain });
    const verifyRouter = createVerifyRouter({ keyManager });

    const signRes = await signRouter(postJson("/sign", {
      evidence: {
        metadata: {
          issuer: "Integration Scanner",
          date: "2026-02-28",
          scope: "AWS production",
        },
        controls: [
          { id: "CC6.1", status: "pass", evidence: "MFA enabled" },
          { id: "CC7.2", status: "fail", evidence: "No weekly scan evidence" },
        ],
      },
    }));

    expect(signRes.status).toBe(200);
    const signBody = await signRes.json() as { cpoe: string; marqueId: string };
    expect(signBody.cpoe).toMatch(/^eyJ/);
    expect(signBody.marqueId).toMatch(/^marque-/);

    const verifyRes = await verifyRouter(postJson("/verify", { cpoe: signBody.cpoe }));
    expect(verifyRes.status).toBe(200);
    const verifyBody = await verifyRes.json() as { verified: boolean; summary?: { controlsTested: number } | null };
    expect(verifyBody.verified).toBe(true);
    expect(verifyBody.summary?.controlsTested).toBe(2);
  });

  test("issue -> verify flow succeeds end-to-end", async () => {
    const issueRouter = createIssueRouter({ keyManager, domain: didDomain });
    const verifyRouter = createVerifyRouter({ keyManager });

    const issueRes = await issueRouter(postJson("/issue", {
      source: "tool",
      metadata: {
        title: "SOC2 snapshot",
        issuer: "Integration Scanner",
        date: "2026-02-28",
        scope: "Production",
      },
      controls: [
        {
          id: "CC6.1",
          description: "MFA on privileged accounts",
          status: "effective",
          evidence: "MFA policy checked",
          frameworkRefs: [{ framework: "SOC2", controlId: "CC6.1" }],
        },
        {
          id: "CC7.2",
          description: "Vulnerability scans",
          status: "ineffective",
          evidence: "Weekly scan job missing",
          frameworkRefs: [{ framework: "SOC2", controlId: "CC7.2" }],
        },
      ],
    }));

    expect(issueRes.status).toBe(201);
    const issueBody = await issueRes.json() as { cpoe: string };
    expect(issueBody.cpoe).toMatch(/^eyJ/);

    const verifyRes = await verifyRouter(postJson("/verify", { cpoe: issueBody.cpoe }));
    expect(verifyRes.status).toBe(200);
    const verifyBody = await verifyRes.json() as {
      verified: boolean;
      issuer: string | null;
      summary?: { controlsFailed: number } | null;
    };
    expect(verifyBody.verified).toBe(true);
    expect(verifyBody.issuer).toBeTruthy();
    expect(verifyBody.summary?.controlsFailed).toBe(1);
  });

  test("hosted trust.txt create -> verify -> public fetch flow succeeds", async () => {
    const store = createMemoryHostedTrustTxtStore();
    const hostRouter = createHostedTrustTxtRouter({
      store,
      trustHost,
      resolveTrustTxt: async (domain: string) => ({
        trustTxt: { did: `did:web:${domain}`, cpoes: [], frameworks: [] },
        source: "delegated-txt",
        url: `https://${trustHost}/trust/${domain}/trust.txt`,
        delegated: { method: "txt", hashPinned: true, hashValid: true },
      }),
    });
    const publicRouter = createHostedTrustTxtPublicHandler({ store });

    const createRes = await hostRouter(withApiKey(postJson("/trust-txt/host", {
      domain: "acme.com",
      contact: "security@acme.com",
      cpoes: ["https://acme.com/compliance/soc2.jwt"],
    }), "integration-key"));
    expect(createRes.status).toBe(200);

    const verifyRes = await hostRouter(withApiKey(postJson("/trust-txt/host/acme.com/verify", {}), "integration-key"));
    expect(verifyRes.status).toBe(200);
    const verifyBody = await verifyRes.json() as { status: string };
    expect(verifyBody.status).toBe("active");

    const publicRes = await publicRouter(new Request("http://localhost/trust/acme.com/trust.txt", { method: "GET" }));
    expect(publicRes.status).toBe(200);
    const trustTxt = await publicRes.text();
    expect(trustTxt).toContain("DID: did:web:acme.com");
    expect(trustTxt).toContain("CPOE: https://acme.com/compliance/soc2.jwt");
  });
});
