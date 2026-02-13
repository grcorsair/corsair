import { describe, test, expect } from "bun:test";
import {
  createBadgeRouter,
  parseBadgeRoute,
  defaultGenerateBadge,
  type BadgeDeps,
  type CPOEMetadata,
} from "../../functions/badge";

// =============================================================================
// MOCK DATA
// =============================================================================

const MOCK_CPOE_VERIFIED: CPOEMetadata = {
  marqueId: "marque-abc123",
  tier: "verified",
  assuranceLevel: 2,
  controlsTested: 24,
  overallScore: 92,
  jwt: "eyJ.test.jwt",
};

const MOCK_CPOE_SELF_SIGNED: CPOEMetadata = {
  marqueId: "marque-def456",
  tier: "self-signed",
  assuranceLevel: 1,
  controlsTested: 10,
  overallScore: 80,
  jwt: "eyJ.self.jwt",
};

function createMockDeps(
  entries: Map<string, CPOEMetadata> = new Map(),
  domainEntries: Map<string, CPOEMetadata> = new Map(),
): BadgeDeps {
  return {
    getCPOEById: async (id) => entries.get(id) || null,
    getLatestByDomain: async (domain) => domainEntries.get(domain) || null,
    generateBadge: defaultGenerateBadge,
  };
}

// =============================================================================
// ROUTE PARSING
// =============================================================================

describe("parseBadgeRoute", () => {
  test("parses /badge/<id>.svg", () => {
    const result = parseBadgeRoute("/badge/marque-abc123.svg");
    expect(result).toEqual({ type: "id", value: "marque-abc123" });
  });

  test("parses /badge/did/<domain>.svg", () => {
    const result = parseBadgeRoute("/badge/did/acme.com.svg");
    expect(result).toEqual({ type: "domain", value: "acme.com" });
  });

  test("returns null for invalid path", () => {
    expect(parseBadgeRoute("/badge/")).toBeNull();
    expect(parseBadgeRoute("/other/path")).toBeNull();
    expect(parseBadgeRoute("/badge")).toBeNull();
  });
});

// =============================================================================
// DEFAULT BADGE GENERATOR
// =============================================================================

describe("defaultGenerateBadge", () => {
  test("generates verified badge SVG", () => {
    const svg = defaultGenerateBadge({ tier: "verified", level: 2, score: 92 });
    expect(svg).toContain("<svg");
    expect(svg).toContain("CPOE");
    expect(svg).toContain("L2 Verified");
    expect(svg).toContain("92%");
    expect(svg).toContain("#2ECC71"); // green
  });

  test("generates self-signed badge SVG", () => {
    const svg = defaultGenerateBadge({ tier: "self-signed", level: 1 });
    expect(svg).toContain("L1 Self-Signed");
    expect(svg).toContain("#F5C542"); // gold
  });

  test("generates expired badge SVG", () => {
    const svg = defaultGenerateBadge({ tier: "expired" });
    expect(svg).toContain("Expired");
    expect(svg).toContain("#E63946"); // red
  });

  test("generates not-found badge SVG", () => {
    const svg = defaultGenerateBadge({ tier: "not-found" });
    expect(svg).toContain("Not Found");
    expect(svg).toContain("#999999"); // gray
  });
});

// =============================================================================
// BADGE ROUTER
// =============================================================================

describe("GET /badge — Badge SVG", () => {
  test("badge by marque ID returns SVG", async () => {
    const deps = createMockDeps(
      new Map([["marque-abc123", MOCK_CPOE_VERIFIED]]),
    );
    const router = createBadgeRouter(deps);
    const req = new Request("http://localhost/badge/marque-abc123.svg", { method: "GET" });

    const res = await router(req);
    expect(res.status).toBe(200);

    const svg = await res.text();
    expect(svg).toContain("<svg");
    expect(svg).toContain("L2 Verified");
  });

  test("badge by domain returns SVG", async () => {
    const deps = createMockDeps(
      new Map(),
      new Map([["acme.com", MOCK_CPOE_SELF_SIGNED]]),
    );
    const router = createBadgeRouter(deps);
    const req = new Request("http://localhost/badge/did/acme.com.svg", { method: "GET" });

    const res = await router(req);
    expect(res.status).toBe(200);

    const svg = await res.text();
    expect(svg).toContain("<svg");
    expect(svg).toContain("L1 Self-Signed");
  });

  test("not found returns gray badge (not 404)", async () => {
    const deps = createMockDeps();
    const router = createBadgeRouter(deps);
    const req = new Request("http://localhost/badge/marque-nonexistent.svg", { method: "GET" });

    const res = await router(req);
    expect(res.status).toBe(200); // Not 404 — returns a badge

    const svg = await res.text();
    expect(svg).toContain("<svg");
    expect(svg).toContain("Not Found");
    expect(svg).toContain("#999999");
  });

  test("correct Content-Type header", async () => {
    const deps = createMockDeps(
      new Map([["marque-abc123", MOCK_CPOE_VERIFIED]]),
    );
    const router = createBadgeRouter(deps);
    const req = new Request("http://localhost/badge/marque-abc123.svg", { method: "GET" });

    const res = await router(req);
    expect(res.headers.get("content-type")).toBe("image/svg+xml");
  });

  test("correct Cache-Control header (5 min)", async () => {
    const deps = createMockDeps(
      new Map([["marque-abc123", MOCK_CPOE_VERIFIED]]),
    );
    const router = createBadgeRouter(deps);
    const req = new Request("http://localhost/badge/marque-abc123.svg", { method: "GET" });

    const res = await router(req);
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
  });

  test("CORS header present", async () => {
    const deps = createMockDeps(
      new Map([["marque-abc123", MOCK_CPOE_VERIFIED]]),
    );
    const router = createBadgeRouter(deps);
    const req = new Request("http://localhost/badge/marque-abc123.svg", { method: "GET" });

    const res = await router(req);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  test("SVG contains expected accessibility attributes", async () => {
    const deps = createMockDeps(
      new Map([["marque-abc123", MOCK_CPOE_VERIFIED]]),
    );
    const router = createBadgeRouter(deps);
    const req = new Request("http://localhost/badge/marque-abc123.svg", { method: "GET" });

    const res = await router(req);
    const svg = await res.text();
    expect(svg).toContain('role="img"');
    expect(svg).toContain("<title>");
  });

  test("rejects non-GET methods", async () => {
    const deps = createMockDeps();
    const router = createBadgeRouter(deps);
    const req = new Request("http://localhost/badge/marque-abc123.svg", { method: "POST" });

    const res = await router(req);
    expect(res.status).toBe(405);
  });

  test("invalid route returns 404 JSON error", async () => {
    const deps = createMockDeps();
    const router = createBadgeRouter(deps);
    const req = new Request("http://localhost/badge/", { method: "GET" });

    const res = await router(req);
    expect(res.status).toBe(404);
  });
});
