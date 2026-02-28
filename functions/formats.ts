/**
 * Supported Formats Endpoint
 *
 * GET /formats — List supported ingestion formats
 * GET /v1/formats — Versioned alias
 */

import { getMappingsWithDiagnostics } from "../src/ingestion/mapping-registry";

export interface SupportedFormat {
  id: string;
  name: string;
  description: string;
  detection: string;
}

interface FormatsResponse {
  ok: true;
  data: SupportedFormat[];
  meta: {
    mappingCount: number;
    loadErrors: number;
  };
}

function jsonError(status: number, message: string): Response {
  return Response.json(
    { ok: false, error: message },
    {
      status,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
      },
    },
  );
}

function jsonOk(data: FormatsResponse): Response {
  return Response.json(data, {
    status: 200,
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

export function createFormatsRouter(): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const pathname = normalizePath(new URL(req.url).pathname);

    if (pathname !== "/formats") {
      return jsonError(404, "Not found");
    }

    if (req.method !== "GET") {
      return jsonError(405, "Method not allowed. Use GET.");
    }

    const { mappings, errors } = getMappingsWithDiagnostics();

    const data: SupportedFormat[] = [
      {
        id: "generic",
        name: "Generic JSON",
        description: "Any JSON payload with { metadata, controls[] }",
        detection: "Fallback default when no mapping matches",
      },
      {
        id: "mapping-pack",
        name: "Mapping Registry",
        description: "Config-driven ingestion using mapping packs",
        detection: "Auto-detected via mapping match rules",
      },
      ...mappings.map((mapping) => ({
        id: `mapping:${mapping.id}`,
        name: mapping.name || mapping.id,
        description: `Mapping format (${mapping.id})`,
        detection: "Auto-detected via mapping match rules",
      })),
    ];

    return jsonOk({
      ok: true,
      data,
      meta: {
        mappingCount: mappings.length,
        loadErrors: errors.length,
      },
    });
  };
}
