const SENSITIVE_KEY_PATTERN = /(password|secret|token|api[_-]?key|private[_-]?key|access[_-]?key|email|owner|account|arn|hostname|host|domain)/i;

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const AWS_ACCOUNT_PATTERN = /\b\d{12}\b/;
const AWS_ARN_PATTERN = /^arn:aws[a-z-]*:/i;
const API_KEY_PATTERN = /\b(?:sk-|api[_-]?key|token)[A-Za-z0-9_-]{8,}\b/i;
const HOST_PATTERN = /\b([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/i;

type JsonLike = null | boolean | number | string | JsonLike[] | { [key: string]: JsonLike };

function redactString(value: string, keyHint?: string): string {
  if (SENSITIVE_KEY_PATTERN.test(keyHint || "")) {
    return "[REDACTED]";
  }
  if (EMAIL_PATTERN.test(value)) return "[REDACTED_EMAIL]";
  if (AWS_ARN_PATTERN.test(value)) return "[REDACTED_ARN]";
  if (AWS_ACCOUNT_PATTERN.test(value)) return "[REDACTED_ACCOUNT_ID]";
  if (API_KEY_PATTERN.test(value)) return "[REDACTED_TOKEN]";
  if (HOST_PATTERN.test(value) && value.includes(".")) return "[REDACTED_HOST]";
  return value;
}

function redactValue(value: JsonLike, keyHint?: string): JsonLike {
  if (typeof value === "string") return redactString(value, keyHint);
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((entry) => redactValue(entry));

  const result: Record<string, JsonLike> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      result[key] = "[REDACTED]";
      continue;
    }
    result[key] = redactValue(entry, key);
  }
  return result;
}

export function redactSensitivePayload<T>(payload: T): T {
  return redactValue(payload as JsonLike) as T;
}
