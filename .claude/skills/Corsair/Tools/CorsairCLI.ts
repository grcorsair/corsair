#!/usr/bin/env bun
/**
 * Corsair CLI Tool Wrapper
 *
 * Provides PAI integration with Corsair primitives.
 * Located in product repo for version locking.
 */

import { execSync } from "child_process";
import path from "path";

const CORSAIR_ROOT = path.resolve(__dirname, "../../../");

export function runCorsair(command: string, args: string[] = []): string {
  const cmd = `cd ${CORSAIR_ROOT} && bun run corsair.ts ${command} ${args.join(" ")}`;

  try {
    const output = execSync(cmd, { encoding: "utf-8" });
    return output;
  } catch (error: any) {
    throw new Error(`Corsair command failed: ${error.message}`);
  }
}

export function recon(targetPath: string): any {
  const output = runCorsair("recon", [targetPath]);
  return JSON.parse(output);
}

export function mark(snapshotPath: string, expectations: string[]): any {
  const expectArgs = expectations.map(e => `--expect "${e}"`);
  const output = runCorsair("mark", [snapshotPath, ...expectArgs]);
  return JSON.parse(output);
}

export function raid(target: string, options: {
  vector: string;
  intensity: number;
  dryRun?: boolean;
}): any {
  const args = [
    target,
    `--vector ${options.vector}`,
    `--intensity ${options.intensity}`,
  ];

  if (options.dryRun) args.push("--dry-run");

  const output = runCorsair("raid", args);
  return JSON.parse(output);
}

export function plunder(raidId: string, outputPath: string): string {
  return runCorsair("plunder", [raidId, `--output ${outputPath}`]);
}

export function chart(findingsPath: string): any {
  const output = runCorsair("chart", [findingsPath]);
  return JSON.parse(output);
}

export function escape(raidId: string): string {
  return runCorsair("escape", [raidId]);
}

// CLI execution
if (import.meta.main) {
  const [command, ...args] = process.argv.slice(2);

  if (!command) {
    console.error("Usage: CorsairCLI.ts <command> [args...]");
    process.exit(1);
  }

  try {
    const output = runCorsair(command, args);
    console.log(output);
  } catch (error: any) {
    console.error(error.message);
    process.exit(1);
  }
}
