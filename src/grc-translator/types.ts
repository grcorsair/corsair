export type GrcTranslateMode = "quick" | "compare";

export type GrcTranslateStyle = "funny" | "plain";

export interface GrcTranslateRequest {
  payload: unknown;
  mode?: GrcTranslateMode;
  models?: string[];
  style?: GrcTranslateStyle;
  redact?: boolean;
  audience?: string;
}

export interface GrcTranslatorOutput {
  headline: string;
  plainEnglish: string;
  grcFindings: string[];
  nextActions: string[];
}

export type GrcTranslateResultStatus = "ok" | "fallback";

export interface GrcTranslateModelUsage {
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
}

export interface GrcTranslateModelResult {
  model: string;
  label: string;
  status: GrcTranslateResultStatus;
  latencyMs: number;
  output: GrcTranslatorOutput;
  usage: GrcTranslateModelUsage;
  error?: string;
}

export interface GrcTranslateConsensus {
  themes: string[];
  disagreements: string[];
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
  consensus: GrcTranslateConsensus;
  cta: {
    sign: "/sign";
    verify: "/verify";
    publish: "/publish";
  };
}

export type GrcTranslateErrorCode =
  | "INVALID_REQUEST"
  | "DISABLED"
  | "MODEL_UNAVAILABLE"
  | "TRANSLATION_FAILED";

export class GrcTranslateError extends Error {
  code: GrcTranslateErrorCode;
  status: number;

  constructor(code: GrcTranslateErrorCode, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export interface ModelCallInput {
  model: string;
  system: string;
  prompt: string;
  maxOutputTokens: number;
  timeoutMs: number;
}

export interface ModelCallResult {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
}
