import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { createIssueRouter } from "../../functions/issue";
import { createSignRouter } from "../../functions/sign";
import { createVerifyRouter } from "../../functions/verify";
import { MarqueKeyManager } from "../../src/parley/marque-key-manager";

const tmpDir = join(import.meta.dir, ".tmp-hot-path-concurrency");
const domain = "concurrency.grcorsair.test";

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

function postJson(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("hot path concurrency", () => {
  test("POST /sign handles concurrent requests without collisions", async () => {
    const router = createSignRouter({ keyManager, domain });
    const requests = Array.from({ length: 20 }, (_, idx) =>
      router(postJson("/sign", {
        evidence: {
          metadata: {
            issuer: "Concurrency Scanner",
            date: "2026-02-28",
            scope: `Env-${idx % 3}`,
          },
          controls: [
            { id: `CC6.1-${idx}`, status: "pass", evidence: "MFA enabled" },
            { id: `CC7.2-${idx}`, status: idx % 5 === 0 ? "fail" : "pass", evidence: "Scan cadence checked" },
          ],
        },
      })),
    );

    const responses = await Promise.all(requests);
    expect(responses.every((res) => res.status === 200)).toBe(true);

    const bodies = await Promise.all(responses.map((res) => res.json() as Promise<{ marqueId: string; cpoe: string }>));
    expect(bodies.every((body) => body.cpoe.startsWith("eyJ"))).toBe(true);
    const ids = new Set(bodies.map((body) => body.marqueId));
    expect(ids.size).toBe(bodies.length);
  });

  test("POST /issue handles concurrent requests without collisions", async () => {
    const router = createIssueRouter({ keyManager, domain });
    const requests = Array.from({ length: 16 }, (_, idx) =>
      router(postJson("/issue", {
        source: "tool",
        metadata: {
          title: `Batch-${idx}`,
          issuer: "Concurrency Scanner",
          date: "2026-02-28",
          scope: `Batch scope ${idx % 4}`,
        },
        controls: [
          {
            id: `CC6.1-${idx}`,
            description: "MFA policy",
            status: "effective",
            frameworkRefs: [{ framework: "SOC2", controlId: "CC6.1" }],
          },
          {
            id: `CC7.2-${idx}`,
            description: "Vulnerability management",
            status: idx % 4 === 0 ? "ineffective" : "effective",
            frameworkRefs: [{ framework: "SOC2", controlId: "CC7.2" }],
          },
        ],
      })),
    );

    const responses = await Promise.all(requests);
    expect(responses.every((res) => res.status === 201)).toBe(true);

    const bodies = await Promise.all(responses.map((res) => res.json() as Promise<{ marqueId: string; cpoe: string }>));
    expect(bodies.every((body) => body.cpoe.startsWith("eyJ"))).toBe(true);
    const ids = new Set(bodies.map((body) => body.marqueId));
    expect(ids.size).toBe(bodies.length);
  });

  test("POST /verify serves concurrent verification requests consistently", async () => {
    const signRouter = createSignRouter({ keyManager, domain });
    const verifyRouter = createVerifyRouter({ keyManager });

    const signRes = await signRouter(postJson("/sign", {
      evidence: {
        metadata: { issuer: "Verify Load", date: "2026-02-28", scope: "Load test" },
        controls: [{ id: "CC6.1", status: "pass", evidence: "MFA policy enabled" }],
      },
    }));
    expect(signRes.status).toBe(200);
    const signed = await signRes.json() as { cpoe: string };

    const requests = Array.from({ length: 40 }, () =>
      verifyRouter(postJson("/verify", { cpoe: signed.cpoe })),
    );
    const responses = await Promise.all(requests);
    expect(responses.every((res) => res.status === 200)).toBe(true);

    const results = await Promise.all(responses.map((res) => res.json() as Promise<{ verified: boolean; issuer: string | null }>));
    expect(results.every((entry) => entry.verified)).toBe(true);
    expect(results.every((entry) => typeof entry.issuer === "string" && entry.issuer.length > 0)).toBe(true);
  });
});
