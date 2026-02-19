import { describe, test, expect } from "bun:test";
import {
  createProfileRouter,
  parseProfileRoute,
  type ProfileDeps,
  type IssuerProfile,
} from "../../functions/profile";

// =============================================================================
// MOCK DATA
// =============================================================================

const MOCK_PROFILE: IssuerProfile = {
  did: "did:web:acme.com",
  domain: "acme.com",
  displayName: "Acme Corporation",
  cpoeCount: 12,
  provenanceSummary: { self: 0, tool: 10, auditor: 2 },
  latestCPOE: {
    marqueId: "marque-latest-001",
    scope: "SOC 2 Type II - Cloud Platform",
    provenance: { source: "tool", sourceIdentity: "Scanner v1.2" },
    overallScore: 92,
    issuedAt: "2026-02-10T00:00:00Z",
    expiresAt: "2026-05-10T00:00:00Z",
  },
  frameworks: ["SOC2", "ISO 27001", "NIST 800-53"],
  firstSeen: "2026-01-01T00:00:00Z",
  lastSeen: "2026-02-10T00:00:00Z",
};

function createMockDeps(
  profiles: Map<string, IssuerProfile> = new Map(),
): ProfileDeps {
  return {
    getIssuerProfile: async (did) => profiles.get(did) || null,
  };
}

// =============================================================================
// ROUTE PARSING
// =============================================================================

describe("parseProfileRoute", () => {
  test("parses /profile/<domain>", () => {
    expect(parseProfileRoute("/profile/acme.com")).toBe("acme.com");
  });

  test("parses domain with subdomain", () => {
    expect(parseProfileRoute("/profile/api.acme.com")).toBe("api.acme.com");
  });

  test("returns null for invalid path", () => {
    expect(parseProfileRoute("/profile/")).toBeNull();
    expect(parseProfileRoute("/profile")).toBeNull();
    expect(parseProfileRoute("/other/acme.com")).toBeNull();
  });

  test("returns null for nested paths", () => {
    expect(parseProfileRoute("/profile/acme.com/extra")).toBeNull();
  });
});

// =============================================================================
// PROFILE ROUTER
// =============================================================================

describe("GET /profile/:domain — Vendor Profile", () => {
  test("returns profile for valid domain", async () => {
    const deps = createMockDeps(
      new Map([["did:web:acme.com", MOCK_PROFILE]]),
    );
    const router = createProfileRouter(deps);
    const req = new Request("http://localhost/profile/acme.com", { method: "GET" });

    const res = await router(req);
    expect(res.status).toBe(200);

    const body: IssuerProfile = await res.json();
    expect(body.did).toBe("did:web:acme.com");
    expect(body.domain).toBe("acme.com");
    expect(body.displayName).toBe("Acme Corporation");
    expect(body.cpoeCount).toBe(12);
    expect(body.frameworks).toContain("SOC2");
    expect(body.firstSeen).toBeTruthy();
    expect(body.lastSeen).toBeTruthy();
  });

  test("profile contains latestCPOE details", async () => {
    const deps = createMockDeps(
      new Map([["did:web:acme.com", MOCK_PROFILE]]),
    );
    const router = createProfileRouter(deps);
    const req = new Request("http://localhost/profile/acme.com", { method: "GET" });

    const res = await router(req);
    const body: IssuerProfile = await res.json();

    expect(body.latestCPOE).toBeDefined();
    expect(body.latestCPOE!.marqueId).toBeTruthy();
    expect(body.latestCPOE!.scope).toBeTruthy();
    expect(body.latestCPOE!.provenance).toEqual({ source: "tool", sourceIdentity: "Scanner v1.2" });
    expect(body.latestCPOE!.overallScore).toBe(92);
    expect(body.latestCPOE!.issuedAt).toBeTruthy();
  });

  test("404 for unknown domain", async () => {
    const deps = createMockDeps();
    const router = createProfileRouter(deps);
    const req = new Request("http://localhost/profile/unknown.com", { method: "GET" });

    const res = await router(req);
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error).toBe("No CPOEs found for this issuer");
  });

  test("correct Cache-Control header (1 hour)", async () => {
    const deps = createMockDeps(
      new Map([["did:web:acme.com", MOCK_PROFILE]]),
    );
    const router = createProfileRouter(deps);
    const req = new Request("http://localhost/profile/acme.com", { method: "GET" });

    const res = await router(req);
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
  });

  test("CORS header present", async () => {
    const deps = createMockDeps(
      new Map([["did:web:acme.com", MOCK_PROFILE]]),
    );
    const router = createProfileRouter(deps);
    const req = new Request("http://localhost/profile/acme.com", { method: "GET" });

    const res = await router(req);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  test("maps domain to did:web DID correctly", async () => {
    // Verify that "beta.io" maps to "did:web:beta.io"
    const betaProfile: IssuerProfile = {
      ...MOCK_PROFILE,
      did: "did:web:beta.io",
      domain: "beta.io",
    };
    const deps = createMockDeps(
      new Map([["did:web:beta.io", betaProfile]]),
    );
    const router = createProfileRouter(deps);
    const req = new Request("http://localhost/profile/beta.io", { method: "GET" });

    const res = await router(req);
    expect(res.status).toBe(200);

    const body: IssuerProfile = await res.json();
    expect(body.did).toBe("did:web:beta.io");
  });

  test("rejects non-GET methods", async () => {
    const deps = createMockDeps();
    const router = createProfileRouter(deps);
    const req = new Request("http://localhost/profile/acme.com", { method: "POST" });

    const res = await router(req);
    expect(res.status).toBe(405);
  });

  test("rejects invalid domain format", async () => {
    const deps = createMockDeps();
    const router = createProfileRouter(deps);
    const req = new Request("http://localhost/profile/not valid domain!", { method: "GET" });

    const res = await router(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("Invalid domain");
  });

  test("invalid route returns 404", async () => {
    const deps = createMockDeps();
    const router = createProfileRouter(deps);
    const req = new Request("http://localhost/profile/", { method: "GET" });

    const res = await router(req);
    expect(res.status).toBe(404);
  });
});
