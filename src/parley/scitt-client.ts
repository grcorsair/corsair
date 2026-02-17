/**
 * SCITT Client — fetch list entries from a transparency log endpoint.
 */

import { isBlockedHost } from "../security/url-validation";
import type { SCITTListEntry } from "./scitt-types";

export interface SCITTListResponse {
  entries: SCITTListEntry[];
  pagination?: {
    limit: number;
    offset: number;
    count: number;
  };
}

export interface SCITTListResolution {
  entries: SCITTListEntry[];
  pagination?: SCITTListResponse["pagination"];
  error?: string;
}

export async function resolveScittEntries(
  url: string,
  fetchFn?: typeof fetch,
): Promise<SCITTListResolution> {
  const urlError = validateHttpsUrl(url, "scitt");
  if (urlError) {
    return { entries: [], error: urlError };
  }

  const doFetch = fetchFn || globalThis.fetch;

  try {
    const response = await doFetch(url, {
      signal: AbortSignal.timeout(5000),
      redirect: "error",
    });
    if (!response.ok) {
      return {
        entries: [],
        error: `HTTP ${(response as Response).status}: ${(response as Response).statusText}`,
      };
    }

    const data = (await response.json()) as SCITTListResponse;
    return {
      entries: Array.isArray(data.entries) ? data.entries : [],
      pagination: data.pagination,
    };
  } catch (e) {
    return {
      entries: [],
      error: `Resolution failed: ${(e as Error).message}`,
    };
  }
}

function validateHttpsUrl(url: string, fieldName: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return `${fieldName}: invalid URL format`;
  }

  if (parsed.protocol !== "https:") {
    return `${fieldName}: must use HTTPS`;
  }

  if (isBlockedHost(parsed.hostname)) {
    return `${fieldName}: Blocked — URL points to private/reserved address: ${parsed.hostname}`;
  }

  return undefined;
}

