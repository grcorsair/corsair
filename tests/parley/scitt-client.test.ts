/**
 * SCITT Client Tests
 */

import { describe, test, expect } from "bun:test";
import { resolveScittEntries } from "../../src/parley/scitt-client";

describe("resolveScittEntries", () => {
  test("returns entries from a valid response", async () => {
    const fakeFetch: typeof fetch = async () => {
      return Response.json({
        entries: [
          {
            entryId: "entry-1",
            registrationTime: "2026-02-17T00:00:00Z",
            treeSize: 1,
            issuer: "did:web:acme.com",
            scope: "SOC2",
            provenance: { source: "tool" },
            summary: { controlsTested: 5, controlsPassed: 5, controlsFailed: 0, overallScore: 100 },
          },
        ],
        pagination: { limit: 20, offset: 0, count: 1 },
      });
    };

    const result = await resolveScittEntries("https://log.example.com/v1/entries", fakeFetch);
    expect(result.error).toBeUndefined();
    expect(result.entries.length).toBe(1);
    expect(result.entries[0]!.entryId).toBe("entry-1");
    expect(result.pagination?.count).toBe(1);
  });

  test("rejects non-https URLs", async () => {
    const result = await resolveScittEntries("http://log.example.com/v1/entries");
    expect(result.error).toContain("must use HTTPS");
  });

  test("rejects blocked hosts", async () => {
    const result = await resolveScittEntries("https://127.0.0.1/v1/entries");
    expect(result.error).toContain("Blocked");
  });
});

