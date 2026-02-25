import type { DocumentSource } from "./types";

// =============================================================================
// SOURCE TIERS
// =============================================================================

export type SourceTier = "native" | "tool" | "platform" | "human" | "unknown";

/**
 * Derive a source tier from the document source.
 * This is deterministic and can be overridden by callers when needed.
 */
export function deriveSourceTier(
  source: DocumentSource,
  override?: SourceTier,
): SourceTier {
  if (override) return override;

  switch (source) {
    case "tool":
    case "json":
      return "tool";
    case "soc2":
    case "iso27001":
    case "pentest":
    case "manual":
      return "human";
    default:
      return "unknown";
  }
}
