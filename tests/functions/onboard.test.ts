import { describe, test, expect, beforeEach } from "bun:test";

import { createOnboardRouter, type OnboardResponse } from "../../functions/onboard";
import { MarqueKeyManager } from "../../src/parley/marque-key-manager";

const TEST_DOMAIN = "test.grcorsair.com";

function makeTempKeyDir(): string {
  return `/tmp/corsair-onboard-keys-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createRequest(body?: Record<string, unknown>): Request {
  return new Request("http://localhost/onboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

describe("POST /onboard", () => {
  let keyManager: MarqueKeyManager;

  beforeEach(async () => {
    keyManager = new MarqueKeyManager(makeTempKeyDir());
  });

  test("returns machine-actionable DID + trust.txt payloads", async () => {
    const router = createOnboardRouter({ keyManager, domain: TEST_DOMAIN });
    const res = await router(createRequest());

    expect(res.status).toBe(200);
    const body: OnboardResponse = await res.json();

    expect(body.domain).toBe(TEST_DOMAIN);
    expect(body.did).toBe(`did:web:${TEST_DOMAIN}`);
    expect(body.files.didJson.content.id).toBe(`did:web:${TEST_DOMAIN}`);
    expect(body.files.trustTxt.content).toContain(`DID: did:web:${TEST_DOMAIN}`);
    expect(body.files.trustTxt.content).toContain(`SCITT: https://${TEST_DOMAIN}/scitt/entries`);
    expect(body.files.trustTxt.content).toContain(`FLAGSHIP: https://${TEST_DOMAIN}/ssf/streams`);
  });

  test("rejects domain mismatch", async () => {
    const router = createOnboardRouter({ keyManager, domain: TEST_DOMAIN });
    const res = await router(createRequest({ domain: "evil.example.com" }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Domain mismatch");
  });

  test("rejects invalid trust.txt inputs", async () => {
    const router = createOnboardRouter({ keyManager, domain: TEST_DOMAIN });
    const res = await router(createRequest({
      cpoes: ["http://insecure.example.com/cpoe.jwt"],
    }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("CPOE[0]");
  });

  test("supports disabling default SCITT/FLAGSHIP entries", async () => {
    const router = createOnboardRouter({ keyManager, domain: TEST_DOMAIN });
    const res = await router(createRequest({ includeDefaults: false }));

    expect(res.status).toBe(200);
    const body: OnboardResponse = await res.json();
    expect(body.files.trustTxt.content).toContain(`DID: did:web:${TEST_DOMAIN}`);
    expect(body.files.trustTxt.content).not.toContain("SCITT:");
    expect(body.files.trustTxt.content).not.toContain("FLAGSHIP:");
  });
});
