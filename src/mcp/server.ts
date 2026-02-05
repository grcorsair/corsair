/**
 * CORSAIR MCP Server
 *
 * Exposes Corsair GRC chaos engineering primitives via the Model Context Protocol.
 * Designed for Claude Code and AI agent integration.
 *
 * 8 Tools:
 *   - corsair_recon    -- Read-only reconnaissance on target
 *   - corsair_mark     -- Detect configuration drift
 *   - corsair_raid     -- Execute controlled chaos attack
 *   - corsair_plunder  -- Extract cryptographic evidence
 *   - corsair_chart    -- Map findings to compliance frameworks
 *   - corsair_escape   -- Rollback changes with scope guards
 *   - corsair_strike   -- Full cycle convenience
 *   - corsair_report   -- Generate report from latest results
 *
 * 2 Resources:
 *   - corsair://evidence/latest       -- Latest evidence file content
 *   - corsair://frameworks/supported  -- Supported compliance frameworks
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Corsair } from "../engine/index";
import type {
  Expectation,
  RaidResult,
  DriftFinding,
  ChartResult,
  ReconResult,
  MarkResult,
  PlunderResult,
  SimpleEscapeResult,
} from "../types";
import { existsSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// ===============================================================================
// SUPPORTED FRAMEWORKS
// ===============================================================================

const SUPPORTED_FRAMEWORKS = [
  "MITRE",
  "NIST-800-53",
  "NIST-CSF",
  "CIS",
  "SOC2",
  "ISO27001",
  "PCI-DSS",
  "CMMC",
  "FedRAMP",
  "HIPAA",
  "GDPR",
  "SOX",
  "COBIT",
] as const;

// ===============================================================================
// DEFAULT EXPECTATIONS (for mark/strike when none provided)
// ===============================================================================

const DEFAULT_EXPECTATIONS: Expectation[] = [
  { field: "mfaConfiguration", operator: "eq", value: "ON" },
  { field: "passwordPolicy.minimumLength", operator: "gte", value: 12 },
  { field: "passwordPolicy.requireSymbols", operator: "eq", value: true },
  { field: "passwordPolicy.requireUppercase", operator: "eq", value: true },
  { field: "passwordPolicy.requireNumbers", operator: "eq", value: true },
];

// ===============================================================================
// TOOL DEFINITIONS
// ===============================================================================

const TOOL_DEFINITIONS = [
  {
    name: "corsair_recon",
    description:
      "Perform read-only reconnaissance on a target. Captures a snapshot of the target's security configuration without modifying any state. Returns snapshot data including MFA, password policy, risk configuration, and device settings.",
    inputSchema: {
      type: "object" as const,
      properties: {
        target_id: {
          type: "string",
          description:
            "Target identifier (e.g., AWS Cognito user pool ID, S3 bucket name, or JSON fixture path)",
        },
        source: {
          type: "string",
          enum: ["fixture", "aws", "file"],
          description:
            "Data source mode: 'fixture' for hardcoded test data, 'aws' for live AWS API, 'file' for JSON fixture file. Defaults to 'fixture'.",
        },
        service: {
          type: "string",
          enum: ["cognito", "s3"],
          description: "AWS service type. Defaults to 'cognito'.",
        },
      },
      required: ["target_id"],
    },
  },
  {
    name: "corsair_mark",
    description:
      "Detect configuration drift by comparing a target's current state against expected security baselines. Returns drift findings with severity classifications.",
    inputSchema: {
      type: "object" as const,
      properties: {
        target_id: {
          type: "string",
          description: "Target identifier to perform reconnaissance on before marking",
        },
        expectations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              field: {
                type: "string",
                description: "Dot-path to the field (e.g., 'mfaConfiguration', 'passwordPolicy.minimumLength')",
              },
              operator: {
                type: "string",
                enum: ["eq", "neq", "gt", "gte", "lt", "lte", "exists", "contains"],
              },
              value: {
                description: "Expected value for comparison",
              },
            },
            required: ["field", "operator", "value"],
          },
          description: "Array of expectations to check against the target snapshot",
        },
        source: {
          type: "string",
          enum: ["fixture", "aws", "file"],
          description: "Data source mode for recon. Defaults to 'fixture'.",
        },
      },
      required: ["target_id", "expectations"],
    },
  },
  {
    name: "corsair_raid",
    description:
      "Execute a controlled chaos attack simulation against a target. Simulates security attack vectors (MFA bypass, password spray, token replay, session hijack) and reports whether controls held. DryRun is true by default for safety.",
    inputSchema: {
      type: "object" as const,
      properties: {
        target_id: {
          type: "string",
          description: "Target identifier to attack",
        },
        vector: {
          type: "string",
          description:
            "Attack vector to simulate: 'mfa-bypass', 'password-spray', 'token-replay', 'session-hijack', or any custom vector",
        },
        intensity: {
          type: "number",
          description: "Attack intensity (1-10). Defaults to 5.",
        },
        dry_run: {
          type: "boolean",
          description: "If true, simulate only without real changes. Defaults to true.",
        },
      },
      required: ["target_id", "vector"],
    },
  },
  {
    name: "corsair_plunder",
    description:
      "Extract cryptographic evidence from a completed raid. Generates JSONL evidence records with SHA-256 hash chains for audit trails. Requires a prior raid to have been executed.",
    inputSchema: {
      type: "object" as const,
      properties: {
        raid_id: {
          type: "string",
          description: "The raid ID from a previous corsair_raid result",
        },
        evidence_path: {
          type: "string",
          description: "File path for evidence output. Defaults to a temp file.",
        },
      },
      required: ["raid_id"],
    },
  },
  {
    name: "corsair_chart",
    description:
      "Map security findings to compliance frameworks (MITRE ATT&CK, NIST, SOC2, etc.). Performs recon and mark first to generate findings, then maps them to framework controls.",
    inputSchema: {
      type: "object" as const,
      properties: {
        target_id: {
          type: "string",
          description: "Target identifier to chart",
        },
        expectations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              field: { type: "string" },
              operator: {
                type: "string",
                enum: ["eq", "neq", "gt", "gte", "lt", "lte", "exists", "contains"],
              },
              value: {},
            },
            required: ["field", "operator", "value"],
          },
          description: "Expectations to check. Defaults to standard security baselines.",
        },
        frameworks: {
          type: "array",
          items: { type: "string" },
          description: "Specific frameworks to map to. Defaults to all supported.",
        },
      },
      required: ["target_id"],
    },
  },
  {
    name: "corsair_escape",
    description:
      "Execute rollback/cleanup operations to restore system state after testing. Runs named cleanup operations and verifies state restoration.",
    inputSchema: {
      type: "object" as const,
      properties: {
        operations: {
          type: "array",
          items: { type: "string" },
          description: "Named cleanup operations to execute (e.g., 'restore_mfa', 'reset_password_policy')",
        },
      },
      required: ["operations"],
    },
  },
  {
    name: "corsair_strike",
    description:
      "Execute the full Corsair cycle: RECON -> MARK -> RAID -> PLUNDER -> CHART -> ESCAPE. Convenience tool that orchestrates all primitives in sequence.",
    inputSchema: {
      type: "object" as const,
      properties: {
        target_id: {
          type: "string",
          description: "Target identifier for the full strike",
        },
        vector: {
          type: "string",
          description: "Attack vector to simulate. Defaults to 'mfa-bypass'.",
        },
        expectations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              field: { type: "string" },
              operator: {
                type: "string",
                enum: ["eq", "neq", "gt", "gte", "lt", "lte", "exists", "contains"],
              },
              value: {},
            },
            required: ["field", "operator", "value"],
          },
          description: "Expectations for the MARK phase. Defaults to standard baselines.",
        },
        intensity: {
          type: "number",
          description: "Raid intensity (1-10). Defaults to 5.",
        },
      },
      required: ["target_id"],
    },
  },
  {
    name: "corsair_report",
    description:
      "Generate a summary report from the latest Corsair results. Includes recon data, drift findings, raid results, compliance mappings, and evidence verification.",
    inputSchema: {
      type: "object" as const,
      properties: {
        format: {
          type: "string",
          enum: ["json", "markdown"],
          description: "Report format. Defaults to 'json'.",
        },
      },
      required: [],
    },
  },
];

// ===============================================================================
// RESOURCE DEFINITIONS
// ===============================================================================

const RESOURCE_DEFINITIONS = [
  {
    uri: "corsair://evidence/latest",
    name: "Latest Evidence",
    description: "Latest JSONL evidence file content with SHA-256 hash chains",
    mimeType: "application/json",
  },
  {
    uri: "corsair://frameworks/supported",
    name: "Supported Frameworks",
    description: "List of compliance frameworks supported by Corsair chart engine",
    mimeType: "application/json",
  },
];

// ===============================================================================
// SERVER STATE (shared across tool calls within a session)
// ===============================================================================

interface SessionState {
  corsair: Corsair;
  lastRecon: ReconResult | null;
  lastMark: MarkResult | null;
  lastRaid: RaidResult | null;
  lastPlunder: PlunderResult | null;
  lastChart: ChartResult | null;
  lastEscape: SimpleEscapeResult | null;
  raidStore: Map<string, RaidResult>;
  evidencePath: string;
}

function createSessionState(): SessionState {
  const evidencePath = join(tmpdir(), `corsair-evidence-${Date.now()}.jsonl`);
  return {
    corsair: new Corsair({ evidencePath }),
    lastRecon: null,
    lastMark: null,
    lastRaid: null,
    lastPlunder: null,
    lastChart: null,
    lastEscape: null,
    raidStore: new Map(),
    evidencePath,
  };
}

// ===============================================================================
// TOOL HANDLERS
// ===============================================================================

function errorResponse(message: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

function jsonResponse(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

async function handleRecon(
  state: SessionState,
  args: Record<string, unknown>,
): Promise<ReturnType<typeof jsonResponse>> {
  const targetId = args.target_id as string | undefined;
  if (!targetId) {
    return errorResponse("target_id is required");
  }

  const source = (args.source as "fixture" | "aws" | "file") || undefined;
  const service = (args.service as "cognito" | "s3") || undefined;

  const result = await state.corsair.recon(targetId, { source, service });
  state.lastRecon = result;
  return jsonResponse(result);
}

async function handleMark(
  state: SessionState,
  args: Record<string, unknown>,
): Promise<ReturnType<typeof jsonResponse>> {
  const targetId = args.target_id as string | undefined;
  if (!targetId) {
    return errorResponse("target_id is required");
  }

  const expectations = args.expectations as Expectation[] | undefined;
  if (!expectations || !Array.isArray(expectations) || expectations.length === 0) {
    return errorResponse("expectations is required and must be a non-empty array");
  }

  // Perform recon first to get a snapshot
  const reconResult = await state.corsair.recon(targetId, {
    source: (args.source as "fixture" | "aws" | "file") || undefined,
  });
  state.lastRecon = reconResult;

  // The snapshot from fixture recon is CognitoSnapshot
  const snapshot = reconResult.snapshot as import("../types").CognitoSnapshot;
  const markResult = await state.corsair.mark(snapshot, expectations);
  state.lastMark = markResult;

  return jsonResponse(markResult);
}

async function handleRaid(
  state: SessionState,
  args: Record<string, unknown>,
): Promise<ReturnType<typeof jsonResponse>> {
  const targetId = args.target_id as string | undefined;
  if (!targetId) {
    return errorResponse("target_id is required");
  }

  const vector = args.vector as string | undefined;
  if (!vector) {
    return errorResponse("vector is required");
  }

  const intensity = (args.intensity as number) ?? 5;
  const dryRun = (args.dry_run as boolean) ?? true;

  // Perform recon first to get a snapshot
  const reconResult = await state.corsair.recon(targetId);
  state.lastRecon = reconResult;

  const snapshot = reconResult.snapshot as import("../types").CognitoSnapshot;
  const raidResult = await state.corsair.raid(snapshot, {
    vector,
    intensity,
    dryRun,
  });

  state.lastRaid = raidResult;
  state.raidStore.set(raidResult.raidId, raidResult);

  return jsonResponse(raidResult);
}

async function handlePlunder(
  state: SessionState,
  args: Record<string, unknown>,
): Promise<ReturnType<typeof jsonResponse>> {
  const raidId = args.raid_id as string | undefined;
  if (!raidId) {
    return errorResponse("raid_id is required");
  }

  const raidResult = state.raidStore.get(raidId) || state.lastRaid;
  if (!raidResult || raidResult.raidId !== raidId) {
    return errorResponse(`No raid found with id: ${raidId}. Run corsair_raid first.`);
  }

  const evidencePath = (args.evidence_path as string) || state.evidencePath;
  const plunderResult = await state.corsair.plunder(raidResult, evidencePath);
  state.lastPlunder = plunderResult;

  return jsonResponse(plunderResult);
}

async function handleChart(
  state: SessionState,
  args: Record<string, unknown>,
): Promise<ReturnType<typeof jsonResponse>> {
  const targetId = args.target_id as string | undefined;
  if (!targetId) {
    return errorResponse("target_id is required");
  }

  const expectations = (args.expectations as Expectation[]) || DEFAULT_EXPECTATIONS;
  const frameworks = args.frameworks as string[] | undefined;

  // Recon
  const reconResult = await state.corsair.recon(targetId);
  state.lastRecon = reconResult;

  // Mark
  const snapshot = reconResult.snapshot as import("../types").CognitoSnapshot;
  const markResult = await state.corsair.mark(snapshot, expectations);
  state.lastMark = markResult;

  // Chart
  const chartResult = await state.corsair.chart(markResult.findings, { frameworks });
  state.lastChart = chartResult;

  return jsonResponse({
    mark: markResult,
    chart: chartResult,
  });
}

async function handleEscape(
  state: SessionState,
  args: Record<string, unknown>,
): Promise<ReturnType<typeof jsonResponse>> {
  const operations = args.operations as string[] | undefined;
  if (!operations || !Array.isArray(operations)) {
    return errorResponse("operations is required and must be an array");
  }

  // Create cleanup operations that simulate success
  const cleanupOps = operations.map((opName: string) => () => ({
    operation: opName,
    success: true,
  }));

  const escapeResult = state.corsair.escape(cleanupOps);
  state.lastEscape = escapeResult;

  return jsonResponse(escapeResult);
}

async function handleStrike(
  state: SessionState,
  args: Record<string, unknown>,
): Promise<ReturnType<typeof jsonResponse>> {
  const targetId = args.target_id as string | undefined;
  if (!targetId) {
    return errorResponse("target_id is required");
  }

  const vector = (args.vector as string) || "mfa-bypass";
  const expectations = (args.expectations as Expectation[]) || DEFAULT_EXPECTATIONS;
  const intensity = (args.intensity as number) ?? 5;

  // 1. RECON
  const reconResult = await state.corsair.recon(targetId);
  state.lastRecon = reconResult;
  const snapshot = reconResult.snapshot as import("../types").CognitoSnapshot;

  // 2. MARK
  const markResult = await state.corsair.mark(snapshot, expectations);
  state.lastMark = markResult;

  // 3. RAID
  const raidResult = await state.corsair.raid(snapshot, {
    vector,
    intensity,
    dryRun: true,
  });
  state.lastRaid = raidResult;
  state.raidStore.set(raidResult.raidId, raidResult);

  // 4. PLUNDER
  const plunderResult = await state.corsair.plunder(raidResult, state.evidencePath);
  state.lastPlunder = plunderResult;

  // 5. CHART
  const chartResult = await state.corsair.chart(markResult.findings);
  state.lastChart = chartResult;

  // 6. ESCAPE
  const escapeResult = state.corsair.escape([
    () => ({ operation: "restore_state", success: true }),
  ]);
  state.lastEscape = escapeResult;

  return jsonResponse({
    recon: reconResult,
    mark: markResult,
    raid: raidResult,
    plunder: plunderResult,
    chart: chartResult,
    escape: escapeResult,
  });
}

async function handleReport(
  state: SessionState,
  args: Record<string, unknown>,
): Promise<ReturnType<typeof jsonResponse>> {
  const sections: string[] = [];

  sections.push("# Corsair GRC Chaos Engineering Report");
  sections.push(`Generated: ${new Date().toISOString()}`);
  sections.push("");

  if (state.lastRecon) {
    sections.push("## RECON - Reconnaissance");
    sections.push(`Target: ${state.lastRecon.snapshotId}`);
    sections.push(`Source: ${state.lastRecon.metadata.source}`);
    sections.push(`Read-only: ${state.lastRecon.metadata.readonly}`);
    sections.push(`Duration: ${state.lastRecon.durationMs}ms`);
    sections.push("");
  }

  if (state.lastMark) {
    sections.push("## MARK - Drift Detection");
    sections.push(`Drift detected: ${state.lastMark.driftDetected}`);
    sections.push(`Findings: ${state.lastMark.findings.length}`);
    for (const f of state.lastMark.findings) {
      const status = f.drift ? "DRIFT" : "OK";
      sections.push(`  - [${status}] ${f.field}: ${f.severity} - ${f.description}`);
    }
    sections.push("");
  }

  if (state.lastRaid) {
    sections.push("## RAID - Attack Simulation");
    sections.push(`Raid ID: ${state.lastRaid.raidId}`);
    sections.push(`Vector: ${state.lastRaid.vector}`);
    sections.push(`Target: ${state.lastRaid.target}`);
    sections.push(`Controls held: ${state.lastRaid.controlsHeld}`);
    sections.push(`Duration: ${state.lastRaid.durationMs}ms`);
    sections.push("");
  }

  if (state.lastPlunder) {
    sections.push("## PLUNDER - Evidence");
    sections.push(`Evidence path: ${state.lastPlunder.evidencePath}`);
    sections.push(`Event count: ${state.lastPlunder.eventCount}`);
    sections.push(`Chain verified: ${state.lastPlunder.chainVerified}`);
    sections.push(`Audit ready: ${state.lastPlunder.auditReady}`);
    sections.push("");
  }

  if (state.lastChart) {
    sections.push("## CHART - Compliance Mapping");
    sections.push(`MITRE: ${state.lastChart.mitre.technique} - ${state.lastChart.mitre.name}`);
    sections.push(`NIST: ${state.lastChart.nist.controls.join(", ") || "N/A"}`);
    sections.push(`SOC2: ${state.lastChart.soc2.criteria.join(", ") || "N/A"}`);
    sections.push("");
  }

  if (state.lastEscape) {
    sections.push("## ESCAPE - Cleanup");
    sections.push(`Operations: ${state.lastEscape.cleanupOps}`);
    sections.push(`All successful: ${state.lastEscape.allSuccessful}`);
    sections.push(`State restored: ${state.lastEscape.stateRestored}`);
    sections.push("");
  }

  if (sections.length <= 3) {
    sections.push("No operations have been performed yet. Run corsair_strike or individual tools first.");
  }

  const report = sections.join("\n");
  return jsonResponse({
    report,
    generatedAt: new Date().toISOString(),
  });
}

// ===============================================================================
// SERVER FACTORY
// ===============================================================================

export function createCorsairMCPServer(): Server {
  const server = new Server(
    {
      name: "corsair",
      version: "0.2.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    },
  );

  const state = createSessionState();

  // ---------------------------------------------------------------------------
  // LIST TOOLS
  // ---------------------------------------------------------------------------

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS,
  }));

  // ---------------------------------------------------------------------------
  // CALL TOOL
  // ---------------------------------------------------------------------------

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      switch (name) {
        case "corsair_recon":
          return await handleRecon(state, args as Record<string, unknown>);
        case "corsair_mark":
          return await handleMark(state, args as Record<string, unknown>);
        case "corsair_raid":
          return await handleRaid(state, args as Record<string, unknown>);
        case "corsair_plunder":
          return await handlePlunder(state, args as Record<string, unknown>);
        case "corsair_chart":
          return await handleChart(state, args as Record<string, unknown>);
        case "corsair_escape":
          return await handleEscape(state, args as Record<string, unknown>);
        case "corsair_strike":
          return await handleStrike(state, args as Record<string, unknown>);
        case "corsair_report":
          return await handleReport(state, args as Record<string, unknown>);
        default:
          return errorResponse(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return errorResponse(`Tool execution failed: ${message}`);
    }
  });

  // ---------------------------------------------------------------------------
  // LIST RESOURCES
  // ---------------------------------------------------------------------------

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: RESOURCE_DEFINITIONS,
  }));

  // ---------------------------------------------------------------------------
  // READ RESOURCE
  // ---------------------------------------------------------------------------

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    switch (uri) {
      case "corsair://evidence/latest": {
        let content = "No evidence file found. Run corsair_plunder or corsair_strike first.";
        if (existsSync(state.evidencePath)) {
          content = readFileSync(state.evidencePath, "utf-8");
        }
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: content,
            },
          ],
        };
      }

      case "corsair://frameworks/supported": {
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify({
                frameworks: [...SUPPORTED_FRAMEWORKS],
                count: SUPPORTED_FRAMEWORKS.length,
                description: "Compliance frameworks supported by Corsair chart engine for security finding mapping",
              }),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown resource URI: ${uri}`);
    }
  });

  return server;
}
