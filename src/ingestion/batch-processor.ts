/**
 * Batch Processor — Process a directory of reports
 *
 * Reads all PDF files in a directory, processes each through the ingestion
 * pipeline, and collects results.
 */

import { existsSync, readdirSync } from "fs";
import { join, extname } from "path";
import type { DocumentSource } from "./types";

export interface BatchOptions {
  /** Output directory for CPOEs */
  outputDir: string;
  /** Document type for all files in batch */
  type: DocumentSource;
  /** DID for issuer */
  did?: string;
  /** Output format */
  format?: "v1" | "vc";
}

export interface BatchResult {
  processed: number;
  succeeded: number;
  failed: number;
  results: Array<{ file: string; cpoe?: string; error?: string }>;
}

/**
 * Process all PDF files in a directory.
 */
export async function processBatch(
  dir: string,
  options: BatchOptions,
): Promise<BatchResult> {
  if (!existsSync(dir)) {
    throw new Error(`Directory not found: ${dir}`);
  }

  const files = readdirSync(dir).filter(f => extname(f).toLowerCase() === ".pdf");

  const result: BatchResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    results: [],
  };

  for (const file of files) {
    result.processed++;
    const filePath = join(dir, file);

    try {
      const { parseSOC2 } = await import("./soc2-parser");
      const { mapToMarqueInput } = await import("./mapper");
      const { MarqueGenerator } = await import("../parley/marque-generator");
      const { MarqueKeyManager } = await import("../parley/marque-key-manager");

      const ingested = await parseSOC2(filePath);
      const input = mapToMarqueInput(ingested, { did: options.did });

      const keyManager = new MarqueKeyManager();
      let keypair = await keyManager.loadKeypair();
      if (!keypair) {
        keypair = await keyManager.generateKeypair();
      }

      const generator = new MarqueGenerator(keyManager, {
        format: options.format || "vc",
      });

      const output = await generator.generateOutput(input);

      const outputFile = join(options.outputDir, `${file.replace(/\.pdf$/i, "")}.cpoe.jwt`);
      const content = output.format === "vc" ? output.jwt! : JSON.stringify(output.v1!, null, 2);

      await Bun.write(outputFile, content);

      result.succeeded++;
      result.results.push({ file, cpoe: outputFile });
    } catch (error) {
      result.failed++;
      result.results.push({
        file,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}
