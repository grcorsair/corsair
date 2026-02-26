import { createHash } from "node:crypto";
import { redactSensitivePayload } from "./redact";
import { buildTranslatorSystemPrompt, buildTranslatorUserPrompt } from "./prompt";
import { callOpenRouterModel } from "./openrouter";
import {
  GrcTranslateError,
  type GrcTranslateMode,
  type GrcTranslateModelResult,
  type GrcTranslateRequest,
  type GrcTranslateResponse,
  type GrcTranslatorOutput,
  type ModelCallInput,
  type ModelCallResult,
} from "./types";

const DEFAULT_MODELS = [
  "google/gemini-3-flash-preview",
  "x-ai/grok-4.1-fast",
  "anthropic/claude-haiku-4.5",
];

const COMPARE_MODELS = [
  "google/gemini-3-flash-preview",
  "x-ai/grok-4.1-fast",
  "anthropic/claude-haiku-4.5",
  "minimax/minimax-m2.1",
  "moonshotai/kimi-k2.5",
  "openai/gpt-5.2-chat",
];

const MAX_MODELS_DEFAULT = 10;
const MAX_INPUT_BYTES_DEFAULT = 131_072;
const MODEL_TIMEOUT_MS_DEFAULT = 20_000;
const MAX_OUTPUT_TOKENS_DEFAULT = 300;

export interface ExecuteGrcTranslateDeps {
  apiKey?: string;
  enabled?: boolean;
  defaultModels?: string[];
  compareModels?: string[];
  maxModels?: number;
  maxInputBytes?: number;
  modelTimeoutMs?: number;
  maxOutputTokens?: number;
  callModel?: (input: ModelCallInput) => Promise<ModelCallResult>;
  now?: () => Date;
}

function uniqueModels(list: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of list) {
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function inferMode(mode?: string): GrcTranslateMode {
  if (!mode || mode === "quick") return "quick";
  if (mode === "compare") return "compare";
  throw new GrcTranslateError("INVALID_REQUEST", "mode must be 'quick' or 'compare'", 400);
}

function ensurePayload(payload: unknown): unknown[] | Record<string, unknown> {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") return payload as Record<string, unknown>;
  throw new GrcTranslateError("INVALID_REQUEST", "payload must be a JSON object or array", 400);
}

function parseJsonObject(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const fence = trimmed.match(/```json\s*([\s\S]*?)```/i);
    if (fence) {
      try {
        return JSON.parse(fence[1] || "") as unknown;
      } catch {
        return null;
      }
    }

    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as unknown;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function parseModelOutput(raw: string): GrcTranslatorOutput | null {
  const parsed = parseJsonObject(raw);
  if (!parsed || typeof parsed !== "object") return null;

  const obj = parsed as {
    roast?: unknown;
    plainEnglish?: unknown;
    grcFindings?: unknown;
    nextActions?: unknown;
  };

  const roast = typeof obj.roast === "string" ? obj.roast.trim() : "";
  const plainEnglish = typeof obj.plainEnglish === "string" ? obj.plainEnglish.trim() : "";
  const grcFindings = Array.isArray(obj.grcFindings)
    ? obj.grcFindings.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean)
    : [];
  const nextActions = Array.isArray(obj.nextActions)
    ? obj.nextActions.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean)
    : [];

  if (!roast || !plainEnglish || grcFindings.length === 0 || nextActions.length === 0) {
    return null;
  }

  return {
    roast,
    plainEnglish,
    grcFindings: grcFindings.slice(0, 6),
    nextActions: nextActions.slice(0, 5),
  };
}

function deterministicFallback(payloadText: string): GrcTranslatorOutput {
  const preview = payloadText.slice(0, 600);
  const keyMatches = [...preview.matchAll(/"([A-Za-z0-9_-]{2,40})"\s*:/g)].map((m) => m[1]).filter(Boolean);
  const keys = [...new Set(keyMatches)].slice(0, 6);

  return {
    roast: "Your JSON is giving 'audit season meets improv night' energy.",
    plainEnglish: "The evidence has useful structure, but trust signals need clearer machine-verifiable anchors.",
    grcFindings: [
      `Top-level signal keys seen: ${keys.length > 0 ? keys.join(", ") : "limited structure"}`,
      "Evidence appears parseable JSON and suitable for automated analysis.",
      "No deterministic proof attached in this translator stage.",
    ],
    nextActions: [
      "Normalize control IDs and statuses to a consistent schema.",
      "Attach timestamps and source provenance for every material finding.",
      "Use Corsair sign/verify to turn this narrative into verifiable proof.",
    ],
  };
}

function consensusFromResults(results: GrcTranslateModelResult[]): { themes: string[]; disagreements: string[] } {
  const themes = new Set<string>();
  const firstActions = new Set<string>();

  for (const result of results) {
    for (const finding of result.output.grcFindings.slice(0, 2)) {
      themes.add(finding);
      if (themes.size >= 6) break;
    }
    if (result.output.nextActions[0]) {
      firstActions.add(result.output.nextActions[0]);
    }
  }

  const disagreements: string[] = [];
  if (firstActions.size > 1) {
    disagreements.push("Models disagree on the top remediation priority.");
  }

  return {
    themes: [...themes].slice(0, 6),
    disagreements,
  };
}

function bytesOf(text: string): number {
  return new TextEncoder().encode(text).length;
}

function modelLabel(id: string): string {
  const parts = id.split("/");
  if (parts.length < 2) return id;
  const raw = parts.slice(1).join("/");
  return raw
    .split(/[-_:/]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function resolveModelList(input: GrcTranslateRequest, mode: GrcTranslateMode, deps: ExecuteGrcTranslateDeps): string[] {
  const explicit = Array.isArray(input.models) ? uniqueModels(input.models) : [];
  if (explicit.length > 0) return explicit;

  const defaults = uniqueModels(
    mode === "quick"
      ? deps.defaultModels || DEFAULT_MODELS
      : deps.compareModels || COMPARE_MODELS,
  );

  if (defaults.length === 0) {
    throw new GrcTranslateError("INVALID_REQUEST", "No models configured for translator", 400);
  }

  return defaults;
}

export async function executeGrcTranslate(
  input: GrcTranslateRequest,
  deps: ExecuteGrcTranslateDeps = {},
): Promise<GrcTranslateResponse> {
  const enabledFlag = deps.enabled ?? ((Bun.env.GRC_TRANSLATOR_ENABLED || "true").toLowerCase() !== "false");
  if (!enabledFlag) {
    throw new GrcTranslateError("DISABLED", "GRC translator is currently disabled", 503);
  }

  const mode = inferMode(input.mode);
  const payload = ensurePayload(input.payload);

  const maxInputBytes = deps.maxInputBytes ?? Number(Bun.env.GRC_TRANSLATOR_MAX_INPUT_BYTES || MAX_INPUT_BYTES_DEFAULT);
  const maxModels = deps.maxModels ?? Number(Bun.env.GRC_TRANSLATOR_MAX_MODELS || MAX_MODELS_DEFAULT);
  const modelTimeoutMs = deps.modelTimeoutMs ?? Number(Bun.env.GRC_TRANSLATOR_MODEL_TIMEOUT_MS || MODEL_TIMEOUT_MS_DEFAULT);
  const maxOutputTokens = deps.maxOutputTokens ?? Number(Bun.env.GRC_TRANSLATOR_MAX_OUTPUT_TOKENS || MAX_OUTPUT_TOKENS_DEFAULT);

  const rawText = JSON.stringify(payload);
  const bytes = bytesOf(rawText);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    throw new GrcTranslateError("INVALID_REQUEST", "payload cannot be empty", 400);
  }
  if (bytes > maxInputBytes) {
    throw new GrcTranslateError("INVALID_REQUEST", `payload exceeds ${maxInputBytes} byte limit`, 413);
  }

  const shouldRedact = input.redact !== false;
  const processedPayload = shouldRedact ? redactSensitivePayload(payload) : payload;
  const processedText = JSON.stringify(processedPayload);

  const models = resolveModelList(input, mode, deps);
  if (models.length > maxModels) {
    throw new GrcTranslateError("INVALID_REQUEST", `too many models requested (max ${maxModels})`, 400);
  }

  const fingerprint = `sha256:${createHash("sha256").update(processedText).digest("hex")}`;
  const style = input.style === "plain" ? "plain" : "funny";
  const audience = input.audience?.trim() || "grc-buyer";

  const payloadPreview = processedText.length > 18_000 ? `${processedText.slice(0, 18_000)}\n... [truncated]` : processedText;
  const system = buildTranslatorSystemPrompt(style);
  const prompt = buildTranslatorUserPrompt({
    payloadPreview,
    audience,
    style,
  });

  const apiKey = deps.apiKey || Bun.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
  const callModel = deps.callModel || (apiKey
    ? ((callInput: ModelCallInput) => callOpenRouterModel(callInput, { apiKey }))
    : null);

  const results: GrcTranslateModelResult[] = [];
  for (const model of models) {
    const startedAt = Date.now();
    const fallback = deterministicFallback(payloadPreview);

    if (!callModel) {
      results.push({
        model,
        label: modelLabel(model),
        status: "fallback",
        latencyMs: Date.now() - startedAt,
        output: fallback,
        usage: {},
        error: "OPENROUTER_API_KEY missing; used deterministic fallback",
      });
      continue;
    }

    try {
      const called = await callModel({
        model,
        system,
        prompt,
        maxOutputTokens,
        timeoutMs: modelTimeoutMs,
      });

      const parsed = parseModelOutput(called.text);
      if (!parsed) {
        results.push({
          model,
          label: modelLabel(model),
          status: "fallback",
          latencyMs: Date.now() - startedAt,
          output: fallback,
          usage: {
            inputTokens: called.inputTokens,
            outputTokens: called.outputTokens,
            estimatedCostUsd: called.estimatedCostUsd,
          },
          error: "Model returned non-conforming output; used fallback",
        });
        continue;
      }

      results.push({
        model,
        label: modelLabel(model),
        status: "ok",
        latencyMs: Date.now() - startedAt,
        output: parsed,
        usage: {
          inputTokens: called.inputTokens,
          outputTokens: called.outputTokens,
          estimatedCostUsd: called.estimatedCostUsd,
        },
      });
    } catch (err) {
      results.push({
        model,
        label: modelLabel(model),
        status: "fallback",
        latencyMs: Date.now() - startedAt,
        output: fallback,
        usage: {},
        error: err instanceof Error ? err.message : "Model execution failed",
      });
    }
  }

  if (results.length === 0) {
    throw new GrcTranslateError("TRANSLATION_FAILED", "No model results produced", 500);
  }

  return {
    runId: crypto.randomUUID(),
    mode,
    input: {
      bytes,
      redacted: shouldRedact,
      fingerprint,
    },
    results,
    consensus: consensusFromResults(results),
    cta: {
      sign: "/sign",
      verify: "/verify",
      publish: "/publish",
    },
  };
}
