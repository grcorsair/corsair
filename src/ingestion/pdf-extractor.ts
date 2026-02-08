/**
 * PDF Extractor — Read PDF files for ingestion
 *
 * Reads PDF files and prepares them for Claude API submission.
 * Uses Anthropic's native PDF support (document content blocks)
 * instead of a separate text extraction library.
 */

import * as fs from "fs";
import * as crypto from "crypto";

export interface ExtractedPDF {
  /** Base64-encoded PDF content */
  base64: string;

  /** SHA-256 hash of the original file for provenance */
  hash: string;

  /** File size in bytes */
  sizeBytes: number;

  /** Original filename */
  filename: string;
}

/**
 * Read a PDF file and prepare it for API submission.
 * Returns base64-encoded content and a SHA-256 hash for provenance.
 */
export function readPDF(filePath: string): ExtractedPDF {
  if (!fs.existsSync(filePath)) {
    throw new Error(`PDF file not found: ${filePath}`);
  }

  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString("base64");
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");

  // Extract filename from path
  const filename = filePath.split("/").pop() || filePath;

  return {
    base64,
    hash,
    sizeBytes: buffer.length,
    filename,
  };
}
