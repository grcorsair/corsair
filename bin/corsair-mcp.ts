#!/usr/bin/env bun
/**
 * Corsair MCP Server — stdio entry point
 *
 * Implements the MCP (Model Context Protocol) over stdio.
 * Provides corsair_sign, corsair_verify, corsair_diff, corsair_formats tools.
 *
 * Usage:
 *   bun run bin/corsair-mcp.ts
 *
 * MCP client configuration (e.g., claude_desktop_config.json):
 *   { "corsair": { "command": "bun", "args": ["run", "bin/corsair-mcp.ts"], "cwd": "/path/to/corsair" } }
 */

import { TOOL_DEFINITIONS, handleToolCall } from "../src/mcp/corsair-mcp-server";
import { MarqueKeyManager } from "../src/parley/marque-key-manager";

const KEY_DIR = process.env.CORSAIR_KEY_DIR || "./keys";
const keyManager = new MarqueKeyManager(KEY_DIR);

// Ensure keys exist
const existing = await keyManager.loadKeypair();
if (!existing) {
  await keyManager.generateKeypair();
}

// MCP stdio protocol: read JSON-RPC from stdin, write to stdout
const decoder = new TextDecoder();

async function readStdinLine(): Promise<string> {
  const reader = Bun.stdin.stream().getReader();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const newlineIdx = buffer.indexOf("\n");
    if (newlineIdx !== -1) {
      const line = buffer.slice(0, newlineIdx);
      reader.releaseLock();
      return line;
    }
  }

  reader.releaseLock();
  return buffer;
}

function sendResponse(response: unknown): void {
  process.stdout.write(JSON.stringify(response) + "\n");
}

// MCP handshake + message loop
async function main(): Promise<void> {
  // Read lines from stdin
  const readable = Bun.stdin.stream();
  const reader = readable.getReader();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Process complete lines
    let newlineIdx: number;
    while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIdx).trim();
      buffer = buffer.slice(newlineIdx + 1);

      if (!line) continue;

      try {
        const message = JSON.parse(line);
        const response = await handleMessage(message);
        if (response) {
          sendResponse(response);
        }
      } catch (err) {
        sendResponse({
          jsonrpc: "2.0",
          error: { code: -32700, message: "Parse error" },
          id: null,
        });
      }
    }
  }
}

async function handleMessage(message: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const id = message.id as string | number | null;
  const method = message.method as string;

  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: "corsair",
            version: "0.5.0",
          },
        },
      };

    case "notifications/initialized":
      return null; // Notification, no response

    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: TOOL_DEFINITIONS,
        },
      };

    case "tools/call": {
      const params = message.params as { name: string; arguments: Record<string, unknown> };
      const result = await handleToolCall(params.name, params.arguments || {}, { keyManager });
      return {
        jsonrpc: "2.0",
        id,
        result,
      };
    }

    default:
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
  }
}

main().catch((err) => {
  console.error("MCP server error:", err);
  process.exit(1);
});
