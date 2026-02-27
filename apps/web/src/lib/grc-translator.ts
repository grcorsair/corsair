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

function extractLikelyJsonBlock(input: string): string | undefined {
  const firstObject = input.indexOf("{");
  const firstArray = input.indexOf("[");
  const starts = [firstObject, firstArray].filter((idx) => idx >= 0);
  if (starts.length === 0) return undefined;
  const start = Math.min(...starts);

  const lastObject = input.lastIndexOf("}");
  const lastArray = input.lastIndexOf("]");
  const end = Math.max(lastObject, lastArray);
  if (end > start) {
    return input.slice(start, end + 1).trim();
  }

  return input.slice(start).trim();
}

function removeTrailingCommas(input: string): string {
  return input.replace(/,\s*([}\]])/g, "$1");
}

function appendMissingClosers(input: string): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (const char of input) {
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{" || char === "[") {
      stack.push(char);
      continue;
    }
    if (char === "}" || char === "]") {
      if (stack.length === 0) continue;
      const top = stack[stack.length - 1];
      if ((top === "{" && char === "}") || (top === "[" && char === "]")) {
        stack.pop();
      }
    }
  }

  if (stack.length === 0) return input;
  const closers = stack
    .reverse()
    .map((open) => (open === "{" ? "}" : "]"))
    .join("");
  return `${input}${closers}`;
}

function parseWithCandidates(input: string): unknown | undefined {
  const candidates = new Set<string>();
  candidates.add(input);

  if (/^"[^"]+"\s*:/.test(input)) {
    candidates.add(`{${input}}`);
  }

  const extracted = extractLikelyJsonBlock(input);
  if (extracted) {
    candidates.add(extracted);
  }

  for (const candidate of [...candidates]) {
    candidates.add(removeTrailingCommas(candidate));
    candidates.add(appendMissingClosers(candidate));
    candidates.add(appendMissingClosers(removeTrailingCommas(candidate)));
  }

  for (const candidate of candidates) {
    const parsed = tryParseJson(candidate);
    if (parsed !== undefined) return parsed;
  }

  return undefined;
}

export function parseJsonPayload(input: string): unknown {
  const trimmed = unwrapCodeFence(input).replace(/^\uFEFF/, "").trim();
  if (!trimmed) {
    throw new Error("Paste JSON evidence first.");
  }

  let parsed = parseWithCandidates(trimmed);

  // Common transport case: a JSON string containing JSON text.
  if (typeof parsed === "string") {
    const nested = parseWithCandidates(parsed);
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
