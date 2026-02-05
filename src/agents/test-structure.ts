#!/usr/bin/env bun
/**
 * Structure test - validates agent components without making API calls
 */

import { corsairTools } from "./tool-definitions";
import { CORSAIR_SYSTEM_PROMPT, MISSION_PLANNING_PROMPT } from "./system-prompts";

console.log("🧪 Testing CORSAIR Agent Structure\n");

// Test 1: Tool definitions
console.log("✓ Tool Definitions:");
console.log(`  - ${corsairTools.length} tools defined`);
for (const tool of corsairTools) {
  console.log(`  - ${tool.name}: ${tool.description.split("\n")[0].slice(0, 60)}...`);
}

// Test 2: System prompts
console.log("\n✓ System Prompts:");
console.log(`  - Main prompt: ${CORSAIR_SYSTEM_PROMPT.length} chars`);
console.log(`  - Planning prompt: ${MISSION_PLANNING_PROMPT.length} chars`);

// Test 3: Tool schema validation
console.log("\n✓ Tool Schema Validation:");
for (const tool of corsairTools) {
  const schema = tool.input_schema;
  if (schema.type !== "object") {
    console.error(`  ✗ ${tool.name}: Invalid schema type`);
    process.exit(1);
  }
  if (!schema.properties) {
    console.error(`  ✗ ${tool.name}: Missing properties`);
    process.exit(1);
  }
  if (!schema.required || schema.required.length === 0) {
    console.error(`  ✗ ${tool.name}: Missing required fields`);
    process.exit(1);
  }
  console.log(`  ✓ ${tool.name}: Valid schema with ${Object.keys(schema.properties).length} properties`);
}

// Test 4: Check CorsairAgent can be imported
console.log("\n✓ Agent Import:");
try {
  const { CorsairAgent } = await import("./corsair-agent");
  console.log(`  ✓ CorsairAgent class imported successfully`);
} catch (error) {
  console.error(`  ✗ Failed to import CorsairAgent:`, error);
  process.exit(1);
}

console.log("\n✅ All structure tests passed!");
console.log("\nNext steps:");
console.log("  1. Set ANTHROPIC_API_KEY environment variable");
console.log("  2. Run: bun run src/agents/example.ts");
