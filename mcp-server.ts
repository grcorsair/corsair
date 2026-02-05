#!/usr/bin/env bun
/**
 * Corsair MCP Server Entry Point
 *
 * Starts the Corsair MCP server over stdio transport.
 * Designed for use with Claude Code and other MCP-compatible clients.
 *
 * Usage:
 *   bun run mcp-server.ts
 *
 * Claude Code config (~/.claude/claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "corsair": {
 *         "command": "bun",
 *         "args": ["run", "/path/to/corsair/mcp-server.ts"]
 *       }
 *     }
 *   }
 */

import { createCorsairMCPServer } from "./src/mcp/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

async function main() {
  const server = createCorsairMCPServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Corsair MCP server started on stdio");
}

main().catch((error) => {
  console.error("Failed to start Corsair MCP server:", error);
  process.exit(1);
});
