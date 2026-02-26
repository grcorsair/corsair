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

export function parseJsonPayload(input: string): unknown {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Paste JSON evidence first.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error("Invalid JSON format.");
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
