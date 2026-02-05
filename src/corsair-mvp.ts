#!/usr/bin/env bun
/**
 * Backwards-compatibility shim. All logic lives in src/engine/.
 */
export * from "./engine/index";

if (import.meta.main) {
  console.log("CORSAIR - Atomic Implementation");
  console.log("Primitives: RECON, MARK, RAID, PLUNDER, CHART, ESCAPE");
  console.log("Tests: bun test tests/primitives/");
}
