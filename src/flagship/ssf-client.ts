/**
 * SSF Client — Stream management over HTTP
 *
 * Supports CRUD operations for SSF streams:
 * - POST /ssf/streams
 * - GET /ssf/streams/:id
 * - PATCH /ssf/streams/:id
 * - DELETE /ssf/streams/:id
 */

import type { SSFStream, SSFStreamConfig } from "./flagship-types";

export interface SSFClientOptions {
  apiUrl: string;
  authToken: string;
  timeoutMs?: number;
}

function normalizeBaseUrl(apiUrl: string): string {
  return apiUrl.replace(/\/+$/, "");
}

function buildStreamUrl(baseUrl: string, streamId?: string): string {
  const base = normalizeBaseUrl(baseUrl);
  return streamId
    ? `${base}/ssf/streams/${encodeURIComponent(streamId)}`
    : `${base}/ssf/streams`;
}

async function requestJson<T>(
  url: string,
  options: SSFClientOptions,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${options.authToken}`,
      ...(init?.headers || {}),
    },
    signal: AbortSignal.timeout(options.timeoutMs ?? 10000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SSF request failed (${res.status}): ${text || res.statusText}`);
  }

  return res.json() as Promise<T>;
}

export async function createSSFStream(
  config: SSFStreamConfig,
  options: SSFClientOptions,
): Promise<SSFStream> {
  const url = buildStreamUrl(options.apiUrl);
  return requestJson<SSFStream>(url, options, {
    method: "POST",
    body: JSON.stringify(config),
  });
}

export async function getSSFStream(
  streamId: string,
  options: SSFClientOptions,
): Promise<SSFStream> {
  const url = buildStreamUrl(options.apiUrl, streamId);
  return requestJson<SSFStream>(url, options, { method: "GET" });
}

export async function updateSSFStream(
  streamId: string,
  updates: Partial<SSFStreamConfig>,
  options: SSFClientOptions,
): Promise<SSFStream> {
  const url = buildStreamUrl(options.apiUrl, streamId);
  return requestJson<SSFStream>(url, options, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function deleteSSFStream(
  streamId: string,
  options: SSFClientOptions,
): Promise<{ status: string; streamId: string }> {
  const url = buildStreamUrl(options.apiUrl, streamId);
  return requestJson<{ status: string; streamId: string }>(url, options, { method: "DELETE" });
}
