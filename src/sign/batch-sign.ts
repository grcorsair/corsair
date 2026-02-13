/**
 * Batch Sign — Sign multiple evidence files in a directory.
 *
 * Usage:
 *   corsair sign --batch <dir> [--output <dir>] [--format <name>]
 *
 * Finds all .json files in the input directory, signs each one,
 * and writes the resulting CPOEs to the output directory.
 */

import { readdirSync, existsSync, mkdirSync } from "fs";
import { join, basename, extname } from "path";
import { signEvidence, type SignInput, type SignOutput } from "./sign-core";
import type { KeyManager } from "../parley/marque-key-manager";

export interface BatchSignOptions {
  inputDir: string;
  outputDir?: string;
  format?: SignInput["format"];
  did?: string;
  scope?: string;
  expiryDays?: number;
  verbose?: boolean;
}

export interface BatchSignResult {
  file: string;
  success: boolean;
  output?: SignOutput;
  outputPath?: string;
  error?: string;
}

/**
 * Sign all .json files in a directory.
 * Returns an array of results — one per file.
 */
export async function signBatch(
  options: BatchSignOptions,
  keyManager: KeyManager,
): Promise<BatchSignResult[]> {
  const { inputDir, outputDir, format, did, scope, expiryDays, verbose } = options;

  if (!existsSync(inputDir)) {
    throw new Error(`Input directory does not exist: ${inputDir}`);
  }

  const outDir = outputDir ?? join(inputDir, "signed");
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const files = readdirSync(inputDir)
    .filter((f) => extname(f).toLowerCase() === ".json")
    .sort();

  if (files.length === 0) {
    throw new Error(`No .json files found in: ${inputDir}`);
  }

  const results: BatchSignResult[] = [];

  for (const file of files) {
    const filePath = join(inputDir, file);

    try {
      const raw = await Bun.file(filePath).text();
      let evidence: unknown;
      try {
        evidence = JSON.parse(raw);
      } catch {
        throw new Error(`Invalid JSON in ${file}`);
      }

      if (verbose) {
        process.stderr.write(`  Signing ${file}...\n`);
      }

      const input: SignInput = {
        evidence: evidence as string | object,
        ...(format && { format }),
        ...(did && { did }),
        ...(scope && { scope }),
        ...(expiryDays && { expiryDays }),
      };

      const output = await signEvidence(input, keyManager);

      const outFile = basename(file, extname(file)) + ".jwt";
      const outPath = join(outDir, outFile);
      await Bun.write(outPath, output.jwt);

      results.push({
        file,
        success: true,
        output,
        outputPath: outPath,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ file, success: false, error: message });

      if (verbose) {
        process.stderr.write(`  ERROR: ${file}: ${message}\n`);
      }
    }
  }

  return results;
}
