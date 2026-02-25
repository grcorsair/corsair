export interface Env {
  TRUST_TXT?: string;
  TRUST_TXT_URL?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/.well-known/trust.txt") {
      return new Response("Not found", { status: 404 });
    }

    if (env.TRUST_TXT_URL) {
      const upstream = await fetch(env.TRUST_TXT_URL, { redirect: "error" });
      if (!upstream.ok) {
        return new Response("Upstream error", { status: 502 });
      }
      const text = await upstream.text();
      return new Response(text, {
        status: 200,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "public, max-age=300",
        },
      });
    }

    if (env.TRUST_TXT) {
      return new Response(env.TRUST_TXT, {
        status: 200,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "public, max-age=300",
        },
      });
    }

    return new Response("Missing TRUST_TXT or TRUST_TXT_URL", { status: 400 });
  },
};
