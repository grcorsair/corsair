import { describe, test, expect } from "bun:test";
import {
  createSCITTListRouter,
  type SCITTListDeps,
  type SCITTListEntry,
  type SCITTListResponse,
} from "../../functions/scitt-list";

// =============================================================================
// MOCK DATA
// =============================================================================

function makeEntry(overrides: Partial<SCITTListEntry> = {}): SCITTListEntry {
  return {
    entryId: `entry-${Math.random().toString(36).slice(2, 10)}`,
    registrationTime: new Date().toISOString(),
    issuer: "did:web:acme.com",
    scope: "SOC 2 Type II - Cloud Platform",
    assuranceLevel: 1,
    summary: {
      controlsTested: 24,
      controlsPassed: 22,
      controlsFailed: 2,
      overallScore: 92,
    },
    ...overrides,
  };
}

const SAMPLE_ENTRIES: SCITTListEntry[] = [
  makeEntry({ entryId: "entry-001", issuer: "did:web:acme.com", scope: "SOC 2 Type II" }),
  makeEntry({ entryId: "entry-002", issuer: "did:web:acme.com", scope: "ISO 27001" }),
  makeEntry({ entryId: "entry-003", issuer: "did:web:beta.io", scope: "SOC 2 Type II" }),
  makeEntry({ entryId: "entry-004", issuer: "did:web:gamma.co", scope: "NIST 800-53" }),
  makeEntry({ entryId: "entry-005", issuer: "did:web:gamma.co", scope: "PCI DSS" }),
];

/**
 * Create a mock listEntries function that supports filtering and pagination.
 */
function createMockListEntries(entries: SCITTListEntry[] = SAMPLE_ENTRIES): SCITTListDeps["listEntries"] {
  return async (options) => {
    let filtered = [...entries];

    if (options.issuer) {
      filtered = filtered.filter((e) => e.issuer === options.issuer);
    }
    if (options.framework) {
      filtered = filtered.filter((e) =>
        e.scope.toLowerCase().includes(options.framework!.toLowerCase()),
      );
    }

    const offset = options.offset ?? 0;
    const limit = options.limit ?? 20;
    return filtered.slice(offset, offset + limit);
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe("GET /scitt/entries — SCITT List", () => {
  test("returns entries with correct format", async () => {
    const router = createSCITTListRouter({ listEntries: createMockListEntries() });
    const req = new Request("http://localhost/scitt/entries", { method: "GET" });

    const res = await router(req);
    expect(res.status).toBe(200);

    const body: SCITTListResponse = await res.json();
    expect(body.entries).toBeArray();
    expect(body.entries.length).toBe(5);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.limit).toBe(20);
    expect(body.pagination.offset).toBe(0);
    expect(body.pagination.count).toBe(5);

    // Verify entry structure
    const entry = body.entries[0];
    expect(entry.entryId).toBe("entry-001");
    expect(entry.issuer).toBe("did:web:acme.com");
    expect(entry.scope).toBeTruthy();
    expect(entry.registrationTime).toBeTruthy();
    expect(entry.summary).toBeDefined();
    expect(entry.summary!.controlsTested).toBeGreaterThan(0);
  });

  test("pagination with limit and offset", async () => {
    const router = createSCITTListRouter({ listEntries: createMockListEntries() });
    const req = new Request("http://localhost/scitt/entries?limit=2&offset=1", { method: "GET" });

    const res = await router(req);
    expect(res.status).toBe(200);

    const body: SCITTListResponse = await res.json();
    expect(body.entries.length).toBe(2);
    expect(body.pagination.limit).toBe(2);
    expect(body.pagination.offset).toBe(1);
    expect(body.entries[0].entryId).toBe("entry-002");
    expect(body.entries[1].entryId).toBe("entry-003");
  });

  test("clamps limit to MAX_LIMIT (100)", async () => {
    const router = createSCITTListRouter({ listEntries: createMockListEntries() });
    const req = new Request("http://localhost/scitt/entries?limit=500", { method: "GET" });

    const res = await router(req);
    const body: SCITTListResponse = await res.json();
    expect(body.pagination.limit).toBe(100);
  });

  test("clamps limit minimum to 1", async () => {
    const router = createSCITTListRouter({ listEntries: createMockListEntries() });
    const req = new Request("http://localhost/scitt/entries?limit=0", { method: "GET" });

    const res = await router(req);
    const body: SCITTListResponse = await res.json();
    expect(body.pagination.limit).toBe(1);
  });

  test("uses default limit for non-numeric value", async () => {
    const router = createSCITTListRouter({ listEntries: createMockListEntries() });
    const req = new Request("http://localhost/scitt/entries?limit=abc", { method: "GET" });

    const res = await router(req);
    const body: SCITTListResponse = await res.json();
    expect(body.pagination.limit).toBe(20);
  });

  test("issuer filtering", async () => {
    const router = createSCITTListRouter({ listEntries: createMockListEntries() });
    const req = new Request("http://localhost/scitt/entries?issuer=did:web:gamma.co", { method: "GET" });

    const res = await router(req);
    const body: SCITTListResponse = await res.json();
    expect(body.entries.length).toBe(2);
    expect(body.entries.every((e) => e.issuer === "did:web:gamma.co")).toBe(true);
  });

  test("framework filtering", async () => {
    const router = createSCITTListRouter({ listEntries: createMockListEntries() });
    const req = new Request("http://localhost/scitt/entries?framework=SOC", { method: "GET" });

    const res = await router(req);
    const body: SCITTListResponse = await res.json();
    // "SOC 2 Type II" contains "SOC" case-insensitively
    expect(body.entries.length).toBe(2);
    expect(body.entries.every((e) => e.scope.toLowerCase().includes("soc"))).toBe(true);
  });

  test("empty results", async () => {
    const router = createSCITTListRouter({ listEntries: createMockListEntries([]) });
    const req = new Request("http://localhost/scitt/entries", { method: "GET" });

    const res = await router(req);
    expect(res.status).toBe(200);

    const body: SCITTListResponse = await res.json();
    expect(body.entries).toBeArray();
    expect(body.entries.length).toBe(0);
    expect(body.pagination.count).toBe(0);
  });

  test("returns CORS headers", async () => {
    const router = createSCITTListRouter({ listEntries: createMockListEntries() });
    const req = new Request("http://localhost/scitt/entries", { method: "GET" });

    const res = await router(req);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  test("rejects non-GET methods", async () => {
    const router = createSCITTListRouter({ listEntries: createMockListEntries() });
    const req = new Request("http://localhost/scitt/entries", { method: "POST" });

    const res = await router(req);
    expect(res.status).toBe(405);
  });

  test("combined issuer and framework filtering", async () => {
    const router = createSCITTListRouter({ listEntries: createMockListEntries() });
    const req = new Request(
      "http://localhost/scitt/entries?issuer=did:web:acme.com&framework=SOC",
      { method: "GET" },
    );

    const res = await router(req);
    const body: SCITTListResponse = await res.json();
    expect(body.entries.length).toBeGreaterThan(0);
    expect(body.entries.every((e) => e.issuer === "did:web:acme.com")).toBe(true);
  });

  test("offset beyond available entries returns empty", async () => {
    const router = createSCITTListRouter({ listEntries: createMockListEntries() });
    const req = new Request("http://localhost/scitt/entries?offset=100", { method: "GET" });

    const res = await router(req);
    const body: SCITTListResponse = await res.json();
    expect(body.entries.length).toBe(0);
    expect(body.pagination.offset).toBe(100);
  });
});
