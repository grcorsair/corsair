import type { ComplianceCatalog, ComplianceCatalogEntry } from "./compliance-catalog";
import type { FetchLike } from "../types/fetch";
import { resolveComplianceCatalog } from "./compliance-catalog";
import { resolveTrustTxt } from "./trust-txt";
import { isBlockedHost } from "../security/url-validation";

export type CpoeResolutionSource = "catalog" | "trust-txt";

export interface ResolvedCpoe {
  url: string;
  issuedAt?: string;
  expiresAt?: string;
  source?: ComplianceCatalogEntry["source"];
  hash?: string;
}

export interface CpoeListResolution {
  cpoes: ResolvedCpoe[];
  source: CpoeResolutionSource;
  trustTxtUrl?: string;
  catalogUrl?: string;
  catalogError?: string;
  error?: string;
}

export interface CpoeResolverDeps {
  fetchFn?: FetchLike;
  resolveTrustTxt?: typeof resolveTrustTxt;
  resolveComplianceCatalog?: typeof resolveComplianceCatalog;
}

export interface CpoeFetchResult {
  jwt: string | null;
  error?: string;
}

export async function resolveCpoeList(
  domain: string,
  deps: CpoeResolverDeps = {},
): Promise<CpoeListResolution> {
  const doResolveTrustTxt = deps.resolveTrustTxt ?? resolveTrustTxt;
  const trustResolution = await doResolveTrustTxt(domain);
  if (!trustResolution.trustTxt) {
    return {
      cpoes: [],
      source: "trust-txt",
      error: trustResolution.error || "Failed to resolve trust.txt",
    };
  }

  const trustTxtUrl = trustResolution.url;
  const trustTxt = trustResolution.trustTxt;
  let catalogError: string | undefined;

  if (trustTxt.catalog) {
    const doResolveCatalog = deps.resolveComplianceCatalog ?? resolveComplianceCatalog;
    const catalogResolution = await doResolveCatalog(trustTxt.catalog, deps.fetchFn);
    if (catalogResolution.catalog) {
      const catalogCpoes = normalizeCatalogCpoes(catalogResolution.catalog);
      if (catalogCpoes.length > 0) {
        return {
          cpoes: catalogCpoes,
          source: "catalog",
          trustTxtUrl,
          catalogUrl: trustTxt.catalog,
        };
      }
    } else {
      catalogError = catalogResolution.error || "Catalog resolution failed";
    }
  }

  const trustTxtCpoes = trustTxt.cpoes.map((url) => ({ url }));
  return {
    cpoes: trustTxtCpoes,
    source: "trust-txt",
    trustTxtUrl,
    catalogUrl: trustTxt.catalog,
    catalogError,
  };
}

export async function fetchCpoeJwt(
  url: string,
  fetchFn?: FetchLike,
): Promise<CpoeFetchResult> {
  const urlError = validateHttpsUrl(url);
  if (urlError) {
    return { jwt: null, error: urlError };
  }

  const doFetch = fetchFn || globalThis.fetch;
  try {
    const res = await doFetch(url, {
      signal: AbortSignal.timeout(5000),
      redirect: "error",
    });

    if (!res.ok) {
      return { jwt: null, error: `HTTP ${(res as Response).status}` };
    }

    const text = (await res.text()).trim();
    const jwt = extractJwtFromContent(text);
    if (!jwt) {
      return { jwt: null, error: "No JWT found" };
    }

    return { jwt };
  } catch (err) {
    return { jwt: null, error: (err as Error).message };
  }
}

function normalizeCatalogCpoes(catalog: ComplianceCatalog): ResolvedCpoe[] {
  const entries = catalog.cpoes.map((entry) => ({
    url: entry.url,
    issuedAt: entry.issuedAt,
    expiresAt: entry.expiresAt,
    source: entry.source,
    hash: entry.hash,
  }));

  return sortByDateDesc(entries);
}

function sortByDateDesc(entries: ResolvedCpoe[]): ResolvedCpoe[] {
  const scored = entries.map((entry, index) => ({
    entry,
    index,
    score: dateScore(entry),
  }));

  const hasDates = scored.some((item) => item.score > 0);
  if (!hasDates) return entries.slice();

  return scored
    .sort((a, b) => {
      if (a.score === b.score) return a.index - b.index;
      return b.score - a.score;
    })
    .map((item) => item.entry);
}

function dateScore(entry: ResolvedCpoe): number {
  const issued = parseDate(entry.issuedAt);
  if (issued > 0) return issued;
  const expires = parseDate(entry.expiresAt);
  if (expires > 0) return expires;
  return 0;
}

function parseDate(value?: string): number {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function extractJwtFromContent(content: string): string | null {
  const trimmed = content.trim();
  if (trimmed.startsWith("eyJ") && trimmed.split(".").length === 3) {
    return trimmed;
  }

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { cpoe?: string; jwt?: string };
      if (parsed.cpoe && typeof parsed.cpoe === "string") return parsed.cpoe;
      if (parsed.jwt && typeof parsed.jwt === "string") return parsed.jwt;
    } catch {
      return null;
    }
  }

  return null;
}

function validateHttpsUrl(url: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "Invalid URL format";
  }

  if (parsed.protocol !== "https:") {
    return "URL must use HTTPS";
  }

  if (isBlockedHost(parsed.hostname)) {
    return `Blocked: URL points to private/reserved address: ${parsed.hostname}`;
  }

  return undefined;
}
