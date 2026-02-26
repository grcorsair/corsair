import type { GrcTranslateStyle } from "./types";

export interface BuildPromptInput {
  payloadPreview: string;
  audience: string;
  style: GrcTranslateStyle;
}

export function buildTranslatorSystemPrompt(style: GrcTranslateStyle): string {
  const tone = style === "funny"
    ? "Use witty, punchy humor. Roast practices, not people."
    : "Use concise neutral tone.";

  return [
    "You are a GRC JSON translator.",
    tone,
    "Never fabricate findings.",
    "Only infer from supplied JSON.",
    "Return strict JSON only with keys: roast, plainEnglish, grcFindings, nextActions.",
    "grcFindings must be an array of 3-6 short factual bullets.",
    "nextActions must be an array of 3-5 actionable bullets.",
  ].join(" ");
}

export function buildTranslatorUserPrompt(input: BuildPromptInput): string {
  return [
    `Audience: ${input.audience}`,
    "Analyze the following JSON evidence and produce the requested output schema.",
    "Evidence JSON:",
    input.payloadPreview,
  ].join("\n\n");
}
