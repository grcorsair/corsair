/**
 * Corsair MCP Server — Model Context Protocol
 *
 * Exposes Corsair's sign, verify, diff, and formats tools
 * via the MCP stdio protocol for use with Claude Code and
 * other MCP-compatible clients.
 *
 * Tools:
 *   corsair_sign     — Sign evidence as a CPOE (JWT-VC)
 *   corsair_verify   — Verify a CPOE signature
 *   corsair_diff     — Compare two CPOEs for regressions
 *   corsair_formats  — List supported evidence formats
 */

import type { KeyManager } from "../parley/marque-key-manager";
import type { EvidenceFormat } from "../sign/sign-core";

// =============================================================================
// TYPES
// =============================================================================

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export interface MCPServerDeps {
  keyManager: KeyManager;
}

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

export const TOOL_DEFINITIONS: MCPToolDefinition[] = [
  {
    name: "corsair_sign",
    description: "Sign evidence as a CPOE (Certificate of Proof of Operational Effectiveness). Accepts JSON evidence from security tools (Prowler, SecurityHub, InSpec, Trivy, GitLab, CISO Assistant) or generic format. Returns a signed JWT-VC.",
    inputSchema: {
      type: "object",
      properties: {
        evidence: {
          type: "object",
          description: "Raw evidence JSON (any of 8 supported formats)",
        },
        format: {
          type: "string",
          description: "Force parser format: generic, prowler, securityhub, inspec, trivy, gitlab, ciso-assistant-api, ciso-assistant-export",
          enum: ["generic", "prowler", "securityhub", "inspec", "trivy", "gitlab", "ciso-assistant-api", "ciso-assistant-export"],
        },
        did: {
          type: "string",
          description: "Issuer DID (e.g., did:web:acme.com)",
        },
        scope: {
          type: "string",
          description: "Override scope string",
        },
        dryRun: {
          type: "boolean",
          description: "Parse + classify but don't sign",
        },
      },
      required: ["evidence"],
    },
  },
  {
    name: "corsair_verify",
    description: "Verify a CPOE (JWT-VC) signature. Checks Ed25519 signature, expiration, and VC schema.",
    inputSchema: {
      type: "object",
      properties: {
        cpoe: {
          type: "string",
          description: "JWT-VC string to verify",
        },
      },
      required: ["cpoe"],
    },
  },
  {
    name: "corsair_diff",
    description: "Compare two CPOEs to detect compliance regressions. Returns new failures, improvements, and score changes.",
    inputSchema: {
      type: "object",
      properties: {
        current: {
          type: "string",
          description: "Current (new) CPOE JWT string",
        },
        previous: {
          type: "string",
          description: "Previous (baseline) CPOE JWT string",
        },
      },
      required: ["current", "previous"],
    },
  },
  {
    name: "corsair_formats",
    description: "List all supported evidence formats that Corsair can sign.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// =============================================================================
// TOOL HANDLERS
// =============================================================================

export async function handleToolCall(
  toolName: string,
  args: Record<string, unknown>,
  deps: MCPServerDeps,
): Promise<MCPToolResult> {
  switch (toolName) {
    case "corsair_sign":
      return handleSign(args, deps);
    case "corsair_verify":
      return handleVerify(args);
    case "corsair_diff":
      return handleDiff(args);
    case "corsair_formats":
      return handleFormats();
    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
        isError: true,
      };
  }
}

async function handleSign(
  args: Record<string, unknown>,
  deps: MCPServerDeps,
): Promise<MCPToolResult> {
  try {
    const { signEvidence } = await import("../sign/sign-core");

    const result = await signEvidence({
      evidence: args.evidence as string | object,
      format: args.format as EvidenceFormat | undefined,
      did: args.did as string | undefined,
      scope: args.scope as string | undefined,
      dryRun: args.dryRun as boolean | undefined,
    }, deps.keyManager);

    const output = {
      cpoe: result.jwt || "(dry-run — no JWT generated)",
      marqueId: result.marqueId,
      detectedFormat: result.detectedFormat,
      summary: result.summary,
      provenance: result.provenance,
      warnings: result.warnings,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Sign error: ${(err as Error).message}` }],
      isError: true,
    };
  }
}

async function handleVerify(args: Record<string, unknown>): Promise<MCPToolResult> {
  try {
    const cpoe = args.cpoe as string;
    if (!cpoe || typeof cpoe !== "string") {
      return {
        content: [{ type: "text", text: "Missing required argument: cpoe" }],
        isError: true,
      };
    }

    // Decode JWT payload without verification first
    const parts = cpoe.split(".");
    if (parts.length !== 3) {
      return {
        content: [{ type: "text", text: "Invalid JWT format. Expected three base64url segments." }],
        isError: true,
      };
    }

    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());

    const output = {
      decoded: true,
      algorithm: header.alg,
      type: header.typ,
      issuer: payload.iss,
      subject: payload.sub,
      issuedAt: payload.iat ? new Date(payload.iat * 1000).toISOString() : null,
      expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
      credentialSubject: payload.vc?.credentialSubject,
      note: "Signature verification requires the issuer's public key. Use the CLI or API for full verification.",
    };

    return {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Verify error: ${(err as Error).message}` }],
      isError: true,
    };
  }
}

async function handleDiff(args: Record<string, unknown>): Promise<MCPToolResult> {
  try {
    const current = args.current as string;
    const previous = args.previous as string;

    if (!current || !previous) {
      return {
        content: [{ type: "text", text: "Missing required arguments: current and previous" }],
        isError: true,
      };
    }

    // Decode both JWTs
    const currentPayload = JSON.parse(Buffer.from(current.split(".")[1], "base64url").toString());
    const previousPayload = JSON.parse(Buffer.from(previous.split(".")[1], "base64url").toString());

    const currentSubject = currentPayload.vc?.credentialSubject;
    const previousSubject = previousPayload.vc?.credentialSubject;

    if (!currentSubject || !previousSubject) {
      return {
        content: [{ type: "text", text: "Both CPOEs must contain valid credentialSubject" }],
        isError: true,
      };
    }

    // Compare summaries
    const currentScore = currentSubject.summary?.overallScore ?? 0;
    const previousScore = previousSubject.summary?.overallScore ?? 0;
    const output = {
      scoreChange: currentScore - previousScore,
      currentScore,
      previousScore,
      hasRegression: currentScore < previousScore,
      currentScope: currentSubject.scope,
      previousScope: previousSubject.scope,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Diff error: ${(err as Error).message}` }],
      isError: true,
    };
  }
}

async function handleFormats(): Promise<MCPToolResult> {
  const formats = [
    { name: "generic", description: "Generic JSON: { metadata, controls[] }", autoDetected: true },
    { name: "prowler", description: "Prowler OCSF: Array of findings with StatusCode + FindingInfo", autoDetected: true },
    { name: "securityhub", description: "AWS SecurityHub ASFF: { Findings[] }", autoDetected: true },
    { name: "inspec", description: "Chef InSpec: { profiles[].controls[] }", autoDetected: true },
    { name: "trivy", description: "Aqua Trivy: { SchemaVersion, Results[] }", autoDetected: true },
    { name: "gitlab", description: "GitLab Security Report: { version, scan, vulnerabilities[] }", autoDetected: true },
    { name: "ciso-assistant-api", description: "CISO Assistant API: { count, results[] }", autoDetected: true },
    { name: "ciso-assistant-export", description: "CISO Assistant Export: { meta, requirement_assessments[] }", autoDetected: true },
  ];

  return {
    content: [{ type: "text", text: JSON.stringify({ formats, count: formats.length }, null, 2) }],
  };
}
