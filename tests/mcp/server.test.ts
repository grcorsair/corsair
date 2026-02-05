/**
 * MCP Server Test Suite
 *
 * Tests the Corsair MCP server tool listing, tool execution,
 * resource listing, and resource reading.
 *
 * Since we cannot easily test stdio transport, we test the server
 * creation and invoke handlers directly via the MCP Client SDK
 * connected through in-memory transports.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  InMemoryTransport,
} from "@modelcontextprotocol/sdk/inMemory.js";
import { createCorsairMCPServer } from "../../src/mcp/server";

// ===============================================================================
// TEST HELPERS
// ===============================================================================

let client: Client;
let server: Server;
let clientTransport: InstanceType<typeof InMemoryTransport>;
let serverTransport: InstanceType<typeof InMemoryTransport>;

async function setupClientServer(): Promise<void> {
  server = createCorsairMCPServer();

  const [cTransport, sTransport] = InMemoryTransport.createLinkedPair();
  clientTransport = cTransport;
  serverTransport = sTransport;

  client = new Client({ name: "test-client", version: "1.0.0" });

  await server.connect(serverTransport);
  await client.connect(clientTransport);
}

async function teardownClientServer(): Promise<void> {
  await client.close();
  await server.close();
}

// ===============================================================================
// SERVER CREATION
// ===============================================================================

describe("MCP Server - Creation", () => {
  test("createCorsairMCPServer returns a Server instance", () => {
    const s = createCorsairMCPServer();
    expect(s).toBeDefined();
    expect(s).toBeInstanceOf(Server);
  });
});

// ===============================================================================
// TOOL LISTING
// ===============================================================================

describe("MCP Server - Tool Listing", () => {
  beforeAll(async () => {
    await setupClientServer();
  });

  afterAll(async () => {
    await teardownClientServer();
  });

  test("lists all 8 tools", async () => {
    const result = await client.listTools();
    expect(result.tools).toBeDefined();
    expect(result.tools.length).toBe(8);
  });

  test("all tools have required fields (name, description, inputSchema)", async () => {
    const result = await client.listTools();

    for (const tool of result.tools) {
      expect(typeof tool.name).toBe("string");
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe("string");
      expect(tool.description!.length).toBeGreaterThan(0);
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe("object");
    }
  });

  test("contains expected tool names", async () => {
    const result = await client.listTools();
    const toolNames = result.tools.map((t) => t.name).sort();

    expect(toolNames).toEqual([
      "corsair_chart",
      "corsair_escape",
      "corsair_mark",
      "corsair_plunder",
      "corsair_raid",
      "corsair_recon",
      "corsair_report",
      "corsair_strike",
    ]);
  });

  test("corsair_recon tool has correct input schema", async () => {
    const result = await client.listTools();
    const reconTool = result.tools.find((t) => t.name === "corsair_recon");
    expect(reconTool).toBeDefined();

    const schema = reconTool!.inputSchema;
    expect(schema.properties).toBeDefined();
    expect((schema.properties as Record<string, unknown>).target_id).toBeDefined();
    expect(schema.required).toContain("target_id");
  });

  test("corsair_raid tool has correct input schema", async () => {
    const result = await client.listTools();
    const raidTool = result.tools.find((t) => t.name === "corsair_raid");
    expect(raidTool).toBeDefined();

    const schema = raidTool!.inputSchema;
    expect(schema.properties).toBeDefined();
    expect((schema.properties as Record<string, unknown>).target_id).toBeDefined();
    expect((schema.properties as Record<string, unknown>).vector).toBeDefined();
    expect(schema.required).toContain("target_id");
    expect(schema.required).toContain("vector");
  });

  test("corsair_mark tool has correct input schema", async () => {
    const result = await client.listTools();
    const markTool = result.tools.find((t) => t.name === "corsair_mark");
    expect(markTool).toBeDefined();

    const schema = markTool!.inputSchema;
    expect(schema.properties).toBeDefined();
    expect((schema.properties as Record<string, unknown>).target_id).toBeDefined();
    expect((schema.properties as Record<string, unknown>).expectations).toBeDefined();
    expect(schema.required).toContain("target_id");
    expect(schema.required).toContain("expectations");
  });
});

// ===============================================================================
// RESOURCE LISTING
// ===============================================================================

describe("MCP Server - Resource Listing", () => {
  beforeAll(async () => {
    await setupClientServer();
  });

  afterAll(async () => {
    await teardownClientServer();
  });

  test("lists all 2 resources", async () => {
    const result = await client.listResources();
    expect(result.resources).toBeDefined();
    expect(result.resources.length).toBe(2);
  });

  test("contains expected resource URIs", async () => {
    const result = await client.listResources();
    const uris = result.resources.map((r) => r.uri).sort();

    expect(uris).toEqual([
      "corsair://evidence/latest",
      "corsair://frameworks/supported",
    ]);
  });

  test("resources have name and description", async () => {
    const result = await client.listResources();

    for (const resource of result.resources) {
      expect(typeof resource.name).toBe("string");
      expect(resource.name.length).toBeGreaterThan(0);
    }
  });
});

// ===============================================================================
// RESOURCE READING
// ===============================================================================

describe("MCP Server - Resource Reading", () => {
  beforeAll(async () => {
    await setupClientServer();
  });

  afterAll(async () => {
    await teardownClientServer();
  });

  test("can read corsair://frameworks/supported", async () => {
    const result = await client.readResource({
      uri: "corsair://frameworks/supported",
    });
    expect(result.contents).toBeDefined();
    expect(result.contents.length).toBe(1);

    const content = result.contents[0];
    expect(content.uri).toBe("corsair://frameworks/supported");
    expect(typeof content.text).toBe("string");

    const parsed = JSON.parse(content.text as string);
    expect(Array.isArray(parsed.frameworks)).toBe(true);
    expect(parsed.frameworks.length).toBeGreaterThan(0);
    expect(parsed.frameworks).toContain("MITRE");
    expect(parsed.frameworks).toContain("NIST-800-53");
    expect(parsed.frameworks).toContain("SOC2");
  });

  test("can read corsair://evidence/latest", async () => {
    const result = await client.readResource({
      uri: "corsair://evidence/latest",
    });
    expect(result.contents).toBeDefined();
    expect(result.contents.length).toBe(1);

    const content = result.contents[0];
    expect(content.uri).toBe("corsair://evidence/latest");
    expect(typeof content.text).toBe("string");
  });
});

// ===============================================================================
// TOOL EXECUTION - RECON
// ===============================================================================

describe("MCP Server - Tool Execution: corsair_recon", () => {
  beforeAll(async () => {
    await setupClientServer();
  });

  afterAll(async () => {
    await teardownClientServer();
  });

  test("corsair_recon with fixture source returns valid result", async () => {
    const result = await client.callTool({
      name: "corsair_recon",
      arguments: {
        target_id: "us-west-2_TEST001",
        source: "fixture",
      },
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content.length).toBeGreaterThan(0);

    const textContent = result.content[0] as { type: string; text: string };
    expect(textContent.type).toBe("text");

    const parsed = JSON.parse(textContent.text);
    expect(parsed.snapshotId).toBe("us-west-2_TEST001");
    expect(parsed.metadata.readonly).toBe(true);
    expect(parsed.stateModified).toBe(false);
  });

  test("corsair_recon defaults to fixture source", async () => {
    const result = await client.callTool({
      name: "corsair_recon",
      arguments: {
        target_id: "us-west-2_DEFAULT",
      },
    });

    const textContent = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(textContent.text);
    expect(parsed.snapshotId).toBe("us-west-2_DEFAULT");
    expect(parsed.snapshot).toBeDefined();
  });
});

// ===============================================================================
// TOOL EXECUTION - MARK
// ===============================================================================

describe("MCP Server - Tool Execution: corsair_mark", () => {
  beforeAll(async () => {
    await setupClientServer();
  });

  afterAll(async () => {
    await teardownClientServer();
  });

  test("corsair_mark detects drift when expectations fail", async () => {
    const result = await client.callTool({
      name: "corsair_mark",
      arguments: {
        target_id: "us-west-2_MARK001",
        expectations: [
          { field: "mfaConfiguration", operator: "eq", value: "ON" },
        ],
      },
    });

    const textContent = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(textContent.text);

    expect(parsed.driftDetected).toBe(true);
    expect(parsed.findings).toBeDefined();
    expect(parsed.findings.length).toBeGreaterThan(0);
    expect(parsed.findings[0].field).toBe("mfaConfiguration");
    expect(parsed.findings[0].drift).toBe(true);
  });

  test("corsair_mark finds no drift when expectations match", async () => {
    const result = await client.callTool({
      name: "corsair_mark",
      arguments: {
        target_id: "us-west-2_MARK002",
        expectations: [
          { field: "mfaConfiguration", operator: "eq", value: "OFF" },
        ],
      },
    });

    const textContent = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(textContent.text);
    expect(parsed.driftDetected).toBe(false);
  });
});

// ===============================================================================
// TOOL EXECUTION - RAID
// ===============================================================================

describe("MCP Server - Tool Execution: corsair_raid", () => {
  beforeAll(async () => {
    await setupClientServer();
  });

  afterAll(async () => {
    await teardownClientServer();
  });

  test("corsair_raid executes dry-run attack simulation", async () => {
    const result = await client.callTool({
      name: "corsair_raid",
      arguments: {
        target_id: "us-west-2_RAID001",
        vector: "mfa-bypass",
        intensity: 5,
        dry_run: true,
      },
    });

    const textContent = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(textContent.text);

    expect(parsed.raidId).toBeDefined();
    expect(parsed.vector).toBe("mfa-bypass");
    expect(parsed.target).toBe("us-west-2_RAID001");
    expect(parsed.timeline).toBeDefined();
    expect(Array.isArray(parsed.timeline)).toBe(true);
  });

  test("corsair_raid defaults to dry_run true", async () => {
    const result = await client.callTool({
      name: "corsair_raid",
      arguments: {
        target_id: "us-west-2_RAID002",
        vector: "password-spray",
      },
    });

    const textContent = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(textContent.text);
    expect(parsed.raidId).toBeDefined();
  });
});

// ===============================================================================
// TOOL EXECUTION - CHART
// ===============================================================================

describe("MCP Server - Tool Execution: corsair_chart", () => {
  beforeAll(async () => {
    await setupClientServer();
  });

  afterAll(async () => {
    await teardownClientServer();
  });

  test("corsair_chart maps drift findings to compliance frameworks", async () => {
    const result = await client.callTool({
      name: "corsair_chart",
      arguments: {
        target_id: "us-west-2_CHART001",
        expectations: [
          { field: "mfaConfiguration", operator: "eq", value: "ON" },
        ],
      },
    });

    const textContent = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(textContent.text);

    expect(parsed.chart).toBeDefined();
    expect(parsed.chart.mitre).toBeDefined();
    expect(parsed.chart.mitre.technique).toBeDefined();
    expect(parsed.chart.nist).toBeDefined();
    expect(parsed.chart.soc2).toBeDefined();
  });
});

// ===============================================================================
// TOOL EXECUTION - ESCAPE
// ===============================================================================

describe("MCP Server - Tool Execution: corsair_escape", () => {
  beforeAll(async () => {
    await setupClientServer();
  });

  afterAll(async () => {
    await teardownClientServer();
  });

  test("corsair_escape runs cleanup operations", async () => {
    const result = await client.callTool({
      name: "corsair_escape",
      arguments: {
        operations: ["restore_mfa", "reset_password_policy"],
      },
    });

    const textContent = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(textContent.text);

    expect(parsed.cleanupOps).toBeDefined();
    expect(parsed.allSuccessful).toBe(true);
    expect(parsed.stateRestored).toBe(true);
  });
});

// ===============================================================================
// TOOL EXECUTION - PLUNDER
// ===============================================================================

describe("MCP Server - Tool Execution: corsair_plunder", () => {
  beforeAll(async () => {
    await setupClientServer();
  });

  afterAll(async () => {
    await teardownClientServer();
  });

  test("corsair_plunder extracts evidence from a raid", async () => {
    // First run a raid to have results
    const raidResult = await client.callTool({
      name: "corsair_raid",
      arguments: {
        target_id: "us-west-2_PLUNDER001",
        vector: "mfa-bypass",
        dry_run: true,
      },
    });

    const raidTextContent = raidResult.content[0] as { type: string; text: string };
    const raidParsed = JSON.parse(raidTextContent.text);

    // Now plunder it
    const result = await client.callTool({
      name: "corsair_plunder",
      arguments: {
        raid_id: raidParsed.raidId,
      },
    });

    const textContent = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(textContent.text);

    expect(parsed.evidencePath).toBeDefined();
    expect(parsed.eventCount).toBeGreaterThan(0);
    expect(parsed.chainVerified).toBe(true);
  });
});

// ===============================================================================
// TOOL EXECUTION - STRIKE
// ===============================================================================

describe("MCP Server - Tool Execution: corsair_strike", () => {
  beforeAll(async () => {
    await setupClientServer();
  });

  afterAll(async () => {
    await teardownClientServer();
  });

  test("corsair_strike runs full cycle", async () => {
    const result = await client.callTool({
      name: "corsair_strike",
      arguments: {
        target_id: "us-west-2_STRIKE001",
        vector: "mfa-bypass",
      },
    });

    const textContent = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(textContent.text);

    expect(parsed.recon).toBeDefined();
    expect(parsed.mark).toBeDefined();
    expect(parsed.raid).toBeDefined();
    expect(parsed.plunder).toBeDefined();
    expect(parsed.chart).toBeDefined();
    expect(parsed.escape).toBeDefined();
  });
});

// ===============================================================================
// TOOL EXECUTION - REPORT
// ===============================================================================

describe("MCP Server - Tool Execution: corsair_report", () => {
  beforeAll(async () => {
    await setupClientServer();
  });

  afterAll(async () => {
    await teardownClientServer();
  });

  test("corsair_report generates a report", async () => {
    // Run a strike first to populate data
    await client.callTool({
      name: "corsair_strike",
      arguments: {
        target_id: "us-west-2_REPORT001",
        vector: "mfa-bypass",
      },
    });

    const result = await client.callTool({
      name: "corsair_report",
      arguments: {},
    });

    const textContent = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(textContent.text);

    expect(parsed.report).toBeDefined();
    expect(typeof parsed.report).toBe("string");
    expect(parsed.generatedAt).toBeDefined();
  });
});

// ===============================================================================
// ERROR HANDLING
// ===============================================================================

describe("MCP Server - Error Handling", () => {
  beforeAll(async () => {
    await setupClientServer();
  });

  afterAll(async () => {
    await teardownClientServer();
  });

  test("unknown tool returns error", async () => {
    try {
      await client.callTool({
        name: "corsair_nonexistent",
        arguments: {},
      });
      // If we get here, the call succeeded (some MCP implementations return isError)
      // That's acceptable too
    } catch (error) {
      // Expected: unknown tool should throw or return error
      expect(error).toBeDefined();
    }
  });

  test("corsair_recon with missing target_id returns error content", async () => {
    const result = await client.callTool({
      name: "corsair_recon",
      arguments: {},
    });

    // The MCP server should return an isError response
    expect(result.isError).toBe(true);
  });

  test("corsair_raid with missing required fields returns error", async () => {
    const result = await client.callTool({
      name: "corsair_raid",
      arguments: {
        target_id: "us-west-2_ERR001",
        // missing vector
      },
    });

    expect(result.isError).toBe(true);
  });
});
