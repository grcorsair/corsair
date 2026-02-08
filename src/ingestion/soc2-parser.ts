/**
 * SOC 2 Parser — LLM-Powered Document Extraction
 *
 * Sends a SOC 2 PDF to Claude and extracts structured control data.
 * Uses Anthropic's native PDF support (document content blocks).
 *
 * Pipeline: PDF file → readPDF() → Claude API → IngestedDocument
 *
 * The LLM does the hard work: understanding SOC 2 structure,
 * identifying controls, determining effectiveness, and mapping
 * to framework control IDs. The code just orchestrates and validates.
 */

import Anthropic from "@anthropic-ai/sdk";
import { readPDF } from "./pdf-extractor";
import type { IngestedDocument, IngestedControl, DocumentMetadata, AssessmentContext } from "./types";

// =============================================================================
// OPTIONS
// =============================================================================

export interface SOC2ParserOptions {
  /** Anthropic API key (defaults to ANTHROPIC_API_KEY env var) */
  apiKey?: string;

  /** Model to use (defaults to claude-sonnet-4-5-20250929) */
  model?: string;

  /** Maximum tokens for response (defaults to 16384) */
  maxTokens?: number;
}

// =============================================================================
// EXTRACTION PROMPT
// =============================================================================

const EXTRACTION_PROMPT = `You are a GRC (Governance, Risk, and Compliance) expert analyzing a SOC 2 report.

Extract ALL security controls from this SOC 2 report and return them as structured JSON.

Return EXACTLY this JSON structure (no markdown, no code fences, just raw JSON):

{
  "metadata": {
    "title": "Full report title",
    "issuer": "Organization name being assessed",
    "date": "Assessment period end date (ISO 8601, e.g. 2025-12-31)",
    "scope": "Brief description of what was assessed",
    "auditor": "Audit firm name",
    "reportType": "SOC 2 Type I or SOC 2 Type II"
  },
  "controls": [
    {
      "id": "Control ID from the report (e.g. CC6.1, CC7.2). Use the Trust Services Criteria ID.",
      "description": "What the control does — be specific and concise",
      "status": "effective OR ineffective OR not-tested",
      "severity": "CRITICAL or HIGH or MEDIUM or LOW based on security impact",
      "evidence": "Brief summary of the test procedure and result, if described",
      "frameworkRefs": [
        {
          "framework": "SOC2",
          "controlId": "The TSC control ID (e.g. CC6.1)",
          "controlName": "Trust Services Criteria name"
        },
        {
          "framework": "NIST-800-53",
          "controlId": "Mapped NIST control (e.g. AC-2, IA-2, SC-28)",
          "controlName": "NIST control name"
        }
      ]
    }
  ],
  "assessmentContext": {
    "techStack": [
      {
        "component": "Component role (e.g. Cloud Provider, IdP, Database)",
        "technology": "Technology name (e.g. AWS, Okta, PostgreSQL)",
        "scope": "What it covers"
      }
    ],
    "gaps": ["Any noted exceptions, carve-outs, or limitations"],
    "scopeCoverage": "Brief scope coverage summary",
    "assessorNotes": "Any notable observations about the assessment quality"
  }
}

RULES:
1. Extract EVERY control mentioned in the report, not just a sample.
2. For status: use "effective" if the auditor found no exceptions. Use "ineffective" if exceptions or deviations were noted. Use "not-tested" if the control was listed but not tested.
3. For severity: CRITICAL = authentication, encryption, access control. HIGH = logging, monitoring, network. MEDIUM = change management, risk assessment. LOW = documentation, awareness.
4. Map each control to both SOC2 TSC and NIST 800-53 framework references.
5. If the report mentions specific technologies (AWS, Azure, Okta, etc.), include them in techStack.
6. Return ONLY valid JSON. No explanation text before or after.`;

// =============================================================================
// PARSER
// =============================================================================

/**
 * Parse a SOC 2 PDF and extract structured control data.
 *
 * @param filePath - Path to the SOC 2 PDF file
 * @param options - Parser options (API key, model, etc.)
 * @returns IngestedDocument with extracted controls
 */
export async function parseSOC2(
  filePath: string,
  options?: SOC2ParserOptions,
): Promise<IngestedDocument> {
  // 1. Read PDF
  const pdf = readPDF(filePath);

  // 2. Send to Claude
  const client = new Anthropic({
    apiKey: options?.apiKey || process.env.ANTHROPIC_API_KEY,
  });

  const model = options?.model || "claude-sonnet-4-5-20250929";
  const maxTokens = options?.maxTokens || 16384;

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdf.base64,
            },
          },
          {
            type: "text",
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
  });

  // 3. Extract text response
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude API");
  }

  // 4. Parse JSON (handle truncated responses)
  const rawJson = extractJSON(textBlock.text);
  const repaired = response.stop_reason === "max_tokens"
    ? repairTruncatedJSON(rawJson)
    : rawJson;
  const parsed = JSON.parse(repaired);

  // 5. Validate and convert to IngestedDocument
  return buildIngestedDocument(parsed, pdf.hash, pdf.filename);
}

/**
 * Parse SOC 2 from pre-extracted text (for testing without PDF).
 */
export async function parseSOC2FromText(
  text: string,
  options?: SOC2ParserOptions,
): Promise<IngestedDocument> {
  const client = new Anthropic({
    apiKey: options?.apiKey || process.env.ANTHROPIC_API_KEY,
  });

  const model = options?.model || "claude-sonnet-4-5-20250929";
  const maxTokens = options?.maxTokens || 16384;

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `${EXTRACTION_PROMPT}\n\nHere is the SOC 2 report text:\n\n${text}`,
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude API");
  }

  const rawJson = extractJSON(textBlock.text);
  const repaired = response.stop_reason === "max_tokens"
    ? repairTruncatedJSON(rawJson)
    : rawJson;
  const parsed = JSON.parse(repaired);

  return buildIngestedDocument(parsed);
}

// =============================================================================
// INTERNAL
// =============================================================================

/**
 * Extract JSON from a response that might have surrounding text or code fences.
 */
function extractJSON(text: string): string {
  // Try to find JSON between code fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  // Try to find raw JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  // Return as-is and let JSON.parse throw if invalid
  return text.trim();
}

/**
 * Attempt to repair JSON truncated by max_tokens.
 * Closes open arrays and objects so we keep the controls we got.
 */
function repairTruncatedJSON(json: string): string {
  // Count open brackets/braces that need closing
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escaped = false;

  for (const char of json) {
    if (escaped) { escaped = false; continue; }
    if (char === "\\") { escaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (char === "{") openBraces++;
    if (char === "}") openBraces--;
    if (char === "[") openBrackets++;
    if (char === "]") openBrackets--;
  }

  // Trim trailing incomplete values (partial strings, trailing commas)
  let repaired = json.replace(/,\s*$/, "");
  // If we're mid-string, close it
  if (inString) repaired += '"';
  // If we're mid-object value, try to close the current object
  // Close all open brackets and braces
  for (let i = 0; i < openBrackets; i++) repaired += "]";
  for (let i = 0; i < openBraces; i++) repaired += "}";

  return repaired;
}

/**
 * Convert raw Claude output to validated IngestedDocument.
 */
function buildIngestedDocument(
  parsed: Record<string, unknown>,
  rawTextHash?: string,
  filename?: string,
): IngestedDocument {
  const metadata = parsed.metadata as Record<string, string> | undefined;
  const controls = parsed.controls as Array<Record<string, unknown>> | undefined;
  const context = parsed.assessmentContext as Record<string, unknown> | undefined;

  if (!controls || !Array.isArray(controls)) {
    throw new Error("Claude response missing 'controls' array");
  }

  const docMetadata: DocumentMetadata = {
    title: metadata?.title || filename || "Unknown SOC 2 Report",
    issuer: metadata?.issuer || "Unknown",
    date: metadata?.date || new Date().toISOString().split("T")[0],
    scope: metadata?.scope || "Not specified",
    auditor: metadata?.auditor,
    reportType: metadata?.reportType || "SOC 2",
    rawTextHash,
  };

  const ingestedControls: IngestedControl[] = controls.map((ctrl) => {
    const status = normalizeStatus(ctrl.status as string);
    const severity = normalizeSeverity(ctrl.severity as string);
    const frameworkRefs = (ctrl.frameworkRefs as Array<Record<string, string>> | undefined)?.map((ref) => ({
      framework: ref.framework || "SOC2",
      controlId: ref.controlId || ctrl.id as string,
      controlName: ref.controlName,
    }));

    return {
      id: (ctrl.id as string) || `ctrl-${Math.random().toString(36).slice(2, 8)}`,
      description: (ctrl.description as string) || "No description",
      status,
      severity,
      evidence: ctrl.evidence as string | undefined,
      frameworkRefs: frameworkRefs?.length ? frameworkRefs : undefined,
    };
  });

  const assessmentContext: AssessmentContext | undefined = context
    ? {
        techStack: (context.techStack as Array<Record<string, string>> | undefined)?.map((ts) => ({
          component: ts.component || "Unknown",
          technology: ts.technology || "Unknown",
          scope: ts.scope || "Not specified",
        })),
        gaps: context.gaps as string[] | undefined,
        scopeCoverage: context.scopeCoverage as string | undefined,
        assessorNotes: context.assessorNotes as string | undefined,
      }
    : undefined;

  return {
    source: "soc2",
    metadata: docMetadata,
    controls: ingestedControls,
    assessmentContext,
  };
}

function normalizeStatus(status: string | undefined): "effective" | "ineffective" | "not-tested" {
  if (!status) return "not-tested";
  const lower = status.toLowerCase();
  if (lower.includes("effective") && !lower.includes("ineffective")) return "effective";
  if (lower.includes("ineffective") || lower.includes("exception") || lower.includes("deviation")) return "ineffective";
  return "not-tested";
}

function normalizeSeverity(severity: string | undefined): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
  if (!severity) return "MEDIUM";
  const upper = severity.toUpperCase();
  if (upper === "CRITICAL") return "CRITICAL";
  if (upper === "HIGH") return "HIGH";
  if (upper === "LOW") return "LOW";
  return "MEDIUM";
}
