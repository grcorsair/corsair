#!/usr/bin/env bun

import { $ } from "bun";

async function main(): Promise<void> {
  console.log("== Connector Guardrails ==");
  console.log("1) Provider mapping tests");
  await $`bun test tests/ingestion/provider-mappings.test.ts`;

  console.log("2) Strict mapping validation");
  await $`bun run corsair.ts mappings validate --strict --json`;

  console.log("Connector guardrails passed.");
}

await main();
