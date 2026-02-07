/**
 * Mock SCITT Registry - In-Memory Transparency Log for Testing
 *
 * Provides a mock implementation of the SCITTRegistry interface
 * for testing CPOE registration and receipt retrieval without
 * requiring a real SCITT transparency service.
 */

import * as crypto from "crypto";
import type { SCITTReceipt, SCITTRegistration, SCITTRegistry } from "./scitt-types";

interface StoredEntry {
  statement: string;
  registrationTime: string;
}

export class MockSCITTRegistry implements SCITTRegistry {
  private entries: Map<string, StoredEntry> = new Map();
  private logId: string;

  constructor(logId?: string) {
    this.logId = logId || "mock-scitt-log";
  }

  async register(statement: string): Promise<SCITTRegistration> {
    const entryId = `entry-${crypto.randomUUID()}`;
    const registrationTime = new Date().toISOString();

    this.entries.set(entryId, { statement, registrationTime });

    return {
      entryId,
      registrationTime,
      status: "registered",
    };
  }

  async getReceipt(entryId: string): Promise<SCITTReceipt | null> {
    const entry = this.entries.get(entryId);
    if (!entry) {
      return null;
    }

    // Generate a mock COSE receipt (hash of the statement as placeholder)
    const proofHash = crypto
      .createHash("sha256")
      .update(entry.statement)
      .digest("base64");

    return {
      entryId,
      registrationTime: entry.registrationTime,
      logId: this.logId,
      proof: proofHash,
    };
  }
}
