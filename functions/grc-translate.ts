import { executeGrcTranslate } from "../src/grc-translator/orchestrator";
import { GrcTranslateError, type GrcTranslateRequest, type GrcTranslateResponse } from "../src/grc-translator/types";

export interface GrcTranslateRouterDeps {
  executeTranslate?: (input: GrcTranslateRequest) => Promise<GrcTranslateResponse>;
}

function jsonError(status: number, message: string, code: string): Response {
  return Response.json(
    { error: message, code },
    {
      status,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
      },
    },
  );
}

function jsonOk(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    },
  });
}

function normalizePath(pathname: string): string {
  if (pathname.startsWith("/v1/")) {
    return pathname.slice(3);
  }
  return pathname;
}

export function createGrcTranslateRouter(deps: GrcTranslateRouterDeps = {}): (req: Request) => Promise<Response> {
  const doExecute = deps.executeTranslate || executeGrcTranslate;

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const path = normalizePath(url.pathname);

    if (path === "/grc/translate" && req.method === "POST") {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return jsonError(400, "Invalid JSON body", "INVALID_REQUEST");
      }

      try {
        const result = await doExecute((body || {}) as GrcTranslateRequest);
        return jsonOk({ result });
      } catch (err) {
        if (err instanceof GrcTranslateError) {
          return jsonError(err.status, err.message, err.code);
        }

        return jsonError(
          500,
          `GRC translate failed: ${err instanceof Error ? err.message : "unknown error"}`,
          "TRANSLATION_FAILED",
        );
      }
    }

    return jsonError(404, "Not found", "NOT_FOUND");
  };
}
