import { afterEach, describe, expect, test } from "bun:test";
import { POST } from "../../apps/web/src/app/api/grc-translate/route";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("web grc translate route smoke", () => {
  test("proxies a valid translator request", async () => {
    let forwarded = false;

    globalThis.fetch = (async (input, init) => {
      forwarded = true;
      expect(String(input)).toBe("https://api.grcorsair.com/grc/translate");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        "content-type": "application/json",
        accept: "application/json",
      });
      const payload = JSON.parse(String(init?.body)) as {
        payload: { framework: string };
        mode: string;
        redact: boolean;
      };
      expect(payload.payload.framework).toBe("SOC2");
      expect(payload.mode).toBe("quick");
      expect(payload.redact).toBe(true);

      return new Response(
        JSON.stringify({
          result: {
            runId: "run_smoke",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const req = new Request("http://localhost/api/grc-translate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.10",
      },
      body: JSON.stringify({
        payload: { framework: "SOC2" },
        mode: "quick",
        redact: true,
      }),
    });

    const res = await POST(req as never);
    expect(forwarded).toBe(true);
    expect(res.status).toBe(200);
    const body = await res.json() as { result?: { runId?: string } };
    expect(body.result?.runId).toBe("run_smoke");
  });
});
