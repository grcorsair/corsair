import { isBlockedHost } from "../src/security/url-validation";
import { scanDomain } from "../src/roast/scanner";
import { generateRoastCopy } from "../src/roast/generate-roast";
import { generateTrustTxtExample } from "../src/roast/generate-trust-txt-example";
import type { RoastCategory, RoastError, RoastResult, RoastScanResult } from "../src/roast/types";
import type { RoastCopyOutput } from "../src/roast/types";
import type { RoastStore } from "../src/roast/storage";

export interface RoastRouterDeps {
  store: RoastStore;
  scanDomain?: (domain: string) => Promise<RoastScanResult>;
  generateRoastCopy?: (input: {
    domain: string;
    compositeScore: number;
    verdict: RoastScanResult["verdict"];
    checks: RoastScanResult["checks"];
  }) => Promise<RoastCopyOutput>;
  generateTrustTxtExample?: (domain: string) => string;
  now?: () => Date;
  ttlDays?: number;
}

function jsonError(status: number, message: string, code: RoastError["code"]): Response {
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

function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/\.$/, "");
}

function isValidDomain(domain: string): boolean {
  if (!domain || domain.length > 253) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(domain)) return false;
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/.test(domain);
}

function categoryRoast(
  category: RoastCategory,
  copy: RoastCopyOutput,
): string {
  return copy.categoryRoasts[category] || "No commentary generated.";
}

export function createRoastRouter(deps: RoastRouterDeps): (req: Request) => Promise<Response> {
  const doScanDomain = deps.scanDomain || ((domain: string) => scanDomain(domain));
  const doGenerateRoastCopy = deps.generateRoastCopy || generateRoastCopy;
  const doGenerateTrustTxtExample = deps.generateTrustTxtExample || generateTrustTxtExample;
  const now = deps.now || (() => new Date());
  const ttlDays = deps.ttlDays || Number(Bun.env.ROAST_TTL_DAYS || "30") || 30;

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const path = normalizePath(url.pathname);

    if (path === "/roast" && req.method === "POST") {
      let body: { domain?: string };
      try {
        body = await req.json();
      } catch {
        return jsonError(400, "Invalid JSON body", "INVALID_DOMAIN");
      }

      const domain = normalizeDomain(body.domain || "");
      if (!isValidDomain(domain)) {
        return jsonError(400, "Invalid domain", "INVALID_DOMAIN");
      }

      if (isBlockedHost(domain)) {
        return jsonError(400, "Blocked domain", "INVALID_DOMAIN");
      }

      try {
        const scan = await doScanDomain(domain);
        const copy = await doGenerateRoastCopy({
          domain: scan.domain,
          compositeScore: scan.compositeScore,
          verdict: scan.verdict,
          checks: scan.checks,
        });

        const createdAt = now().toISOString();
        const id = crypto.randomUUID();
        const result: RoastResult = {
          id,
          domain: scan.domain,
          compositeScore: scan.compositeScore,
          verdict: scan.verdict,
          checks: scan.checks.map((check) => ({
            ...check,
            roast: categoryRoast(check.category, copy),
          })),
          summaryRoast: copy.summaryRoast,
          fixPreview: copy.fixPreview,
          trustTxtExample: doGenerateTrustTxtExample(scan.domain),
          createdAt,
        };

        await deps.store.save(result, ttlDays);

        return jsonOk({ result });
      } catch (err) {
        return jsonError(
          500,
          `Roast scan failed: ${err instanceof Error ? err.message : "unknown error"}`,
          "SCAN_FAILED",
        );
      }
    }

    if (path.startsWith("/roast/") && req.method === "GET") {
      const id = decodeURIComponent(path.slice("/roast/".length));
      if (!id) {
        return jsonError(404, "Roast not found", "NOT_FOUND");
      }

      const stored = await deps.store.get(id);
      if (!stored) {
        return jsonError(404, "Roast not found", "NOT_FOUND");
      }

      return jsonOk({ result: stored });
    }

    return jsonError(404, "Not found", "NOT_FOUND");
  };
}
