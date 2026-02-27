export type GrcTranslateMode = "quick" | "compare";

export interface GrcTranslatorOutput {
  roast: string;
  plainEnglish: string;
  grcFindings: string[];
  nextActions: string[];
}

export interface GrcTranslateModelResult {
  model: string;
  label: string;
  status: "ok" | "fallback";
  latencyMs: number;
  output: GrcTranslatorOutput;
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    estimatedCostUsd?: number;
  };
  error?: string;
}

export interface GrcTranslateResponse {
  runId: string;
  mode: GrcTranslateMode;
  input: {
    bytes: number;
    redacted: boolean;
    fingerprint: string;
  };
  results: GrcTranslateModelResult[];
  consensus: {
    themes: string[];
    disagreements: string[];
  };
  cta: {
    sign: "/sign";
    verify: "/verify";
    publish: "/publish";
  };
}

export interface GrcTranslateError {
  error: string;
  code?: "INVALID_REQUEST" | "DISABLED" | "MODEL_UNAVAILABLE" | "TRANSLATION_FAILED" | "RATE_LIMITED";
}

export const GRC_TRANSLATOR_MAX_INPUT_BYTES = 131_072;

export function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function unwrapCodeFence(input: string): string {
  const match = input.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (match?.[1] ?? input).trim();
}

function tryParseJson(input: string): unknown | undefined {
  try {
    return JSON.parse(input) as unknown;
  } catch {
    return undefined;
  }
}

export function parseJsonPayload(input: string): unknown {
  const trimmed = unwrapCodeFence(input).replace(/^\uFEFF/, "").trim();
  if (!trimmed) {
    throw new Error("Paste JSON evidence first.");
  }

  let parsed = tryParseJson(trimmed);

  // Common paste case: raw object snippet without outer braces, e.g. `"Sid": "...", "Effect": "..."`
  if (parsed === undefined && /^"[^"]+"\s*:/.test(trimmed)) {
    parsed = tryParseJson(`{${trimmed}}`);
  }

  // Common transport case: a JSON string containing JSON text.
  if (typeof parsed === "string") {
    const nested = tryParseJson(parsed);
    if (nested !== undefined) parsed = nested;
  }

  if (parsed === undefined) {
    throw new Error("Invalid JSON format. If this is a snippet, include braces.");
  }

  if (parsed === null || typeof parsed !== "object") {
    throw new Error("JSON must be an object or array.");
  }

  const size = byteLength(trimmed);
  if (size > GRC_TRANSLATOR_MAX_INPUT_BYTES) {
    throw new Error(`JSON payload exceeds ${GRC_TRANSLATOR_MAX_INPUT_BYTES} byte limit.`);
  }

  return parsed;
}
