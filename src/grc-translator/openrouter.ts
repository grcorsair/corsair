import type { FetchLike } from "../types/fetch";
import { GrcTranslateError, type ModelCallInput, type ModelCallResult } from "./types";

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

export interface OpenRouterDeps {
  apiKey: string;
  fetchFn?: FetchLike;
}

export async function callOpenRouterModel(input: ModelCallInput, deps: OpenRouterDeps): Promise<ModelCallResult> {
  const fetchFn = deps.fetchFn || globalThis.fetch;

  const res = await fetchFn("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${deps.apiKey}`,
      "content-type": "application/json",
      "HTTP-Referer": Bun.env.OPENROUTER_HTTP_REFERER || "https://grcorsair.com",
      "X-Title": "Corsair GRC Translator",
    },
    body: JSON.stringify({
      model: input.model,
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.prompt },
      ],
      temperature: 0.7,
      max_tokens: input.maxOutputTokens,
    }),
    signal: AbortSignal.timeout(input.timeoutMs),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GrcTranslateError(
      "MODEL_UNAVAILABLE",
      `OpenRouter model call failed (${res.status}): ${body.slice(0, 200)}`,
      502,
    );
  }

  const data = await res.json() as OpenRouterResponse;
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new GrcTranslateError("MODEL_UNAVAILABLE", "OpenRouter returned empty content", 502);
  }

  return {
    text,
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
  };
}
