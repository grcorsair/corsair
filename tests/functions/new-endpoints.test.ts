/**
 * New Endpoint Tests — Audit, Certification, TPRM, Webhooks, Billing
 *
 * Tests the Railway Function endpoints for all new engines.
 * Calls handler functions directly with Request objects.
 * Follows the pattern from tests/functions/api.test.ts.
 */

import { describe, test, expect, beforeEach } from "bun:test";

// Endpoint handlers
import { createAuditHandler } from "../../functions/audit";
import { createCertCreateHandler } from "../../functions/cert-create";
import { createCertStatusHandler } from "../../functions/cert-status";
import { createCertListHandler } from "../../functions/cert-list";
import { createTPRMAssessHandler } from "../../functions/tprm-assess";
import { createTPRMVendorsHandler } from "../../functions/tprm-vendors";
import { createTPRMDashboardHandler } from "../../functions/tprm-dashboard";
import { createWebhooksHandler } from "../../functions/webhooks";
import { createBillingHandler } from "../../functions/billing";

// Engines
import { CertificationEngine } from "../../src/certification/certification-engine";
import { TPRMEngine } from "../../src/tprm/tprm-engine";
import { WebhookManager } from "../../src/webhooks/webhook-manager";
import { SubscriptionManager } from "../../src/billing/subscription-manager";

// =============================================================================
// HELPERS
// =============================================================================

function jsonRequest(
  method: string,
  path: string,
  body?: unknown,
  auth?: boolean,
): Request {
  const url = `http://localhost${path}`;
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (auth) {
    headers["Authorization"] = "Bearer test-api-key";
  }
  const init: RequestInit = {
    method,
    headers,
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return new Request(url, init);
}

async function jsonBody(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

// =============================================================================
// AUDIT ENDPOINT
// =============================================================================

describe("Audit Endpoint", () => {
  let handler: (req: Request) => Promise<Response>;

  beforeEach(() => {
    handler = createAuditHandler();
  });

  test("POST /audit returns 405 for GET", async () => {
    const req = jsonRequest("GET", "/audit", undefined, true);
    const res = await handler(req);
    expect(res.status).toBe(405);
  });

  test("POST /audit returns 400 for missing fields", async () => {
    const req = jsonRequest("POST", "/audit", {}, true);
    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = await jsonBody(res);
    expect(body.ok).toBe(false);
    expect(body.error).toBeDefined();
  });

  test("POST /audit returns 400 for missing scope", async () => {
    const req = jsonRequest("POST", "/audit", { files: ["test.json"] }, true);
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  test("POST /audit returns 400 for invalid JSON", async () => {
    const url = "http://localhost/audit";
    const req = new Request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer test-api-key",
      },
      body: "not-valid-json{",
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  test("POST /audit response has APIEnvelope structure", async () => {
    const req = jsonRequest("POST", "/audit", {
      files: [],
      scope: "Test Audit",
      frameworks: ["SOC2"],
    }, true);
    const res = await handler(req);
    const body = await jsonBody(res);
    expect(body).toHaveProperty("ok");
    // Even if audit succeeds or fails, envelope is present
    expect(typeof body.ok).toBe("boolean");
  });

  test("POST /audit with valid empty files returns result", async () => {
    const req = jsonRequest("POST", "/audit", {
      files: [],
      scope: "Empty Audit Scope",
      frameworks: ["SOC2"],
    }, true);
    const res = await handler(req);
    expect(res.status).toBe(200);
    const body = await jsonBody(res);
    expect(body.ok).toBe(true);
    const data = body.data as Record<string, unknown>;
    expect(data.id).toBeDefined();
    expect(data.scope).toBeDefined();
    expect(data.summary).toBeDefined();
  });

  test("POST /audit sets CORS headers", async () => {
    const req = jsonRequest("POST", "/audit", {
      files: [],
      scope: "Test",
      frameworks: [],
    }, true);
    const res = await handler(req);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});

// =============================================================================
// CERT CREATE ENDPOINT
// =============================================================================

describe("Cert Create Endpoint", () => {
  let handler: (req: Request) => Promise<Response>;
  let engine: CertificationEngine;

  beforeEach(() => {
    engine = new CertificationEngine();
    handler = createCertCreateHandler({ engine });
  });

  test("POST /cert returns 405 for GET", async () => {
    const req = jsonRequest("GET", "/cert", undefined, true);
    const res = await handler(req);
    expect(res.status).toBe(405);
  });

  test("POST /cert returns 400 for missing orgId", async () => {
    const req = jsonRequest("POST", "/cert", {
      scope: { name: "Test", frameworks: [], evidencePaths: [] },
    }, true);
    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = await jsonBody(res);
    expect(body.ok).toBe(false);
  });

  test("POST /cert returns 400 for missing scope", async () => {
    const req = jsonRequest("POST", "/cert", { orgId: "org-1" }, true);
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  test("POST /cert creates a certification with valid input", async () => {
    const req = jsonRequest("POST", "/cert", {
      orgId: "org-1",
      scope: { name: "AWS Production", frameworks: ["SOC2"], evidencePaths: [] },
      policy: {
        minimumScore: 70,
        warningThreshold: 80,
        auditIntervalDays: 90,
        gracePeriodDays: 14,
      },
    }, true);
    const res = await handler(req);
    expect(res.status).toBe(201);
    const body = await jsonBody(res);
    expect(body.ok).toBe(true);
    const data = body.data as Record<string, unknown>;
    expect(data.id).toBeDefined();
    expect(data.orgId).toBe("org-1");
    expect(data.status).toBeDefined();
  });

  test("POST /cert response has APIEnvelope structure", async () => {
    const req = jsonRequest("POST", "/cert", {
      orgId: "org-1",
      scope: { name: "Test", frameworks: [], evidencePaths: [] },
    }, true);
    const res = await handler(req);
    const body = await jsonBody(res);
    expect(body).toHaveProperty("ok");
    expect(typeof body.ok).toBe("boolean");
  });

  test("POST /cert returns 400 for invalid JSON", async () => {
    const url = "http://localhost/cert";
    const req = new Request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer test-api-key",
      },
      body: "{{invalid",
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
  });
});

// =============================================================================
// CERT STATUS ENDPOINT
// =============================================================================

describe("Cert Status Endpoint", () => {
  let handler: (req: Request) => Promise<Response>;
  let engine: CertificationEngine;

  beforeEach(() => {
    engine = new CertificationEngine();
    handler = createCertStatusHandler({ engine });
  });

  test("GET /cert/status?id=xxx returns 400 for missing id", async () => {
    const req = jsonRequest("GET", "/cert/status");
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  test("GET /cert/status?id=xxx returns 404 for unknown cert", async () => {
    const req = jsonRequest("GET", "/cert/status?id=cert-nonexistent");
    const res = await handler(req);
    expect(res.status).toBe(404);
  });

  test("GET /cert/status returns certification when it exists", async () => {
    // Create a cert via the engine directly
    const policy = {
      id: "policy-1",
      name: "Test Policy",
      scope: { name: "Test", frameworks: ["SOC2"], evidencePaths: [] },
      minimumScore: 70,
      warningThreshold: 80,
      auditIntervalDays: 90,
      freshnessMaxDays: 7,
      gracePeriodDays: 14,
      autoRenew: false,
      autoSuspend: false,
      notifyOnChange: false,
    };
    const auditResult = {
      id: "audit-1",
      scope: { name: "Test", frameworks: ["SOC2"], evidencePaths: [] },
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      duration: 100,
      evidence: [],
      score: { composite: 85, grade: "B", dimensions: [], controlsScored: 0, scoredAt: new Date().toISOString(), engineVersion: "1.0.0" },
      findings: [],
      summary: { totalControls: 10, passed: 8, failed: 2, skipped: 0, score: 80, grade: "B", criticalFindings: 0, highFindings: 0 },
    };
    const cert = engine.createCertification("org-1", policy, auditResult as any);

    const req = jsonRequest("GET", `/cert/status?id=${cert.id}`);
    const res = await handler(req);
    expect(res.status).toBe(200);
    const body = await jsonBody(res);
    expect(body.ok).toBe(true);
    const data = body.data as Record<string, unknown>;
    expect(data.id).toBe(cert.id);
    expect(data.status).toBeDefined();
  });

  test("GET /cert/status does not require auth (public)", async () => {
    // No auth header — should still work (just returns 400 for missing id, not 401)
    const req = jsonRequest("GET", "/cert/status");
    const res = await handler(req);
    expect(res.status).toBe(400); // Missing id, not 401
  });

  test("GET /cert/status sets CORS headers", async () => {
    const req = jsonRequest("GET", "/cert/status?id=test");
    const res = await handler(req);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});

// =============================================================================
// CERT LIST ENDPOINT
// =============================================================================

describe("Cert List Endpoint", () => {
  let handler: (req: Request) => Promise<Response>;
  let engine: CertificationEngine;

  beforeEach(() => {
    engine = new CertificationEngine();
    handler = createCertListHandler({ engine });
  });

  test("GET /cert/list returns empty array when no certs exist", async () => {
    const req = jsonRequest("GET", "/cert/list", undefined, true);
    const res = await handler(req);
    expect(res.status).toBe(200);
    const body = await jsonBody(res);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect((body.data as unknown[]).length).toBe(0);
  });

  test("GET /cert/list returns certifications", async () => {
    const policy = {
      id: "policy-1",
      name: "Test Policy",
      scope: { name: "Test", frameworks: ["SOC2"], evidencePaths: [] },
      minimumScore: 70,
      warningThreshold: 80,
      auditIntervalDays: 90,
      freshnessMaxDays: 7,
      gracePeriodDays: 14,
      autoRenew: false,
      autoSuspend: false,
      notifyOnChange: false,
    };
    const auditResult = {
      id: "audit-1",
      scope: { name: "Test", frameworks: ["SOC2"], evidencePaths: [] },
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      duration: 100,
      evidence: [],
      score: { composite: 85, grade: "B", dimensions: [], controlsScored: 0, scoredAt: new Date().toISOString(), engineVersion: "1.0.0" },
      findings: [],
      summary: { totalControls: 10, passed: 8, failed: 2, skipped: 0, score: 80, grade: "B", criticalFindings: 0, highFindings: 0 },
    };
    engine.createCertification("org-1", policy, auditResult as any);

    const req = jsonRequest("GET", "/cert/list", undefined, true);
    const res = await handler(req);
    expect(res.status).toBe(200);
    const body = await jsonBody(res);
    expect(body.ok).toBe(true);
    expect((body.data as unknown[]).length).toBe(1);
  });

  test("GET /cert/list filters by orgId", async () => {
    const makePolicy = (id: string) => ({
      id,
      name: "Test Policy",
      scope: { name: "Test", frameworks: [], evidencePaths: [] },
      minimumScore: 70,
      warningThreshold: 80,
      auditIntervalDays: 90,
      freshnessMaxDays: 7,
      gracePeriodDays: 14,
      autoRenew: false,
      autoSuspend: false,
      notifyOnChange: false,
    });
    const auditResult = {
      id: "audit-1",
      scope: { name: "Test", frameworks: [], evidencePaths: [] },
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      duration: 100,
      evidence: [],
      score: { composite: 85, grade: "B", dimensions: [], controlsScored: 0, scoredAt: new Date().toISOString(), engineVersion: "1.0.0" },
      findings: [],
      summary: { totalControls: 10, passed: 8, failed: 2, skipped: 0, score: 80, grade: "B", criticalFindings: 0, highFindings: 0 },
    };
    engine.createCertification("org-1", makePolicy("p1"), auditResult as any);
    engine.createCertification("org-2", makePolicy("p2"), auditResult as any);

    const req = jsonRequest("GET", "/cert/list?orgId=org-1", undefined, true);
    const res = await handler(req);
    const body = await jsonBody(res);
    expect(body.ok).toBe(true);
    expect((body.data as unknown[]).length).toBe(1);
  });

  test("GET /cert/list returns 405 for POST", async () => {
    const req = jsonRequest("POST", "/cert/list", {}, true);
    const res = await handler(req);
    expect(res.status).toBe(405);
  });
});

// =============================================================================
// TPRM ASSESS ENDPOINT
// =============================================================================

describe("TPRM Assess Endpoint", () => {
  let handler: (req: Request) => Promise<Response>;
  let engine: TPRMEngine;

  beforeEach(() => {
    engine = new TPRMEngine();
    handler = createTPRMAssessHandler({ engine });
  });

  test("POST /tprm/assess returns 405 for GET", async () => {
    const req = jsonRequest("GET", "/tprm/assess", undefined, true);
    const res = await handler(req);
    expect(res.status).toBe(405);
  });

  test("POST /tprm/assess returns 400 for missing vendorId", async () => {
    const req = jsonRequest("POST", "/tprm/assess", {
      frameworks: ["SOC2"],
      cpoes: [],
    }, true);
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  test("POST /tprm/assess returns 400 for missing frameworks", async () => {
    const req = jsonRequest("POST", "/tprm/assess", {
      vendorId: "vendor-1",
      cpoes: [],
    }, true);
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  test("POST /tprm/assess runs assessment with valid input", async () => {
    // Register vendor first
    const vendor = engine.registerVendor({
      name: "Acme Corp",
      domain: "acme.com",
      did: "did:web:acme.com",
      riskTier: "medium",
      tags: ["cloud"],
    });

    // Create assessment request
    const request = engine.requestAssessment(vendor.id, {
      requestedBy: "admin",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });

    const req = jsonRequest("POST", "/tprm/assess", {
      vendorId: vendor.id,
      frameworks: ["SOC2"],
      cpoes: [],
      requestId: request.id,
    }, true);
    const res = await handler(req);
    expect(res.status).toBe(200);
    const body = await jsonBody(res);
    expect(body.ok).toBe(true);
    const data = body.data as Record<string, unknown>;
    expect(data.id).toBeDefined();
    expect(data.compositeScore).toBeDefined();
    expect(data.decision).toBeDefined();
  });

  test("POST /tprm/assess response has envelope structure", async () => {
    const req = jsonRequest("POST", "/tprm/assess", {
      vendorId: "v1",
      frameworks: [],
      cpoes: [],
    }, true);
    const res = await handler(req);
    const body = await jsonBody(res);
    expect(body).toHaveProperty("ok");
  });
});

// =============================================================================
// TPRM VENDORS ENDPOINT
// =============================================================================

describe("TPRM Vendors Endpoint", () => {
  let handler: (req: Request) => Promise<Response>;
  let engine: TPRMEngine;

  beforeEach(() => {
    engine = new TPRMEngine();
    handler = createTPRMVendorsHandler({ engine });
  });

  test("GET /tprm/vendors returns empty list initially", async () => {
    const req = jsonRequest("GET", "/tprm/vendors", undefined, true);
    const res = await handler(req);
    expect(res.status).toBe(200);
    const body = await jsonBody(res);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect((body.data as unknown[]).length).toBe(0);
  });

  test("POST /tprm/vendors registers a new vendor", async () => {
    const req = jsonRequest("POST", "/tprm/vendors", {
      name: "Acme Corp",
      domain: "acme.com",
      did: "did:web:acme.com",
      riskTier: "high",
      tags: ["cloud", "saas"],
    }, true);
    const res = await handler(req);
    expect(res.status).toBe(201);
    const body = await jsonBody(res);
    expect(body.ok).toBe(true);
    const data = body.data as Record<string, unknown>;
    expect(data.id).toBeDefined();
    expect(data.name).toBe("Acme Corp");
  });

  test("POST /tprm/vendors returns 400 for missing name", async () => {
    const req = jsonRequest("POST", "/tprm/vendors", {
      domain: "acme.com",
      did: "did:web:acme.com",
      riskTier: "high",
      tags: [],
    }, true);
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  test("GET /tprm/vendors filters by riskTier", async () => {
    engine.registerVendor({
      name: "High Risk",
      domain: "high.com",
      did: "did:web:high.com",
      riskTier: "high",
      tags: [],
    });
    engine.registerVendor({
      name: "Low Risk",
      domain: "low.com",
      did: "did:web:low.com",
      riskTier: "low",
      tags: [],
    });

    const req = jsonRequest("GET", "/tprm/vendors?riskTier=high", undefined, true);
    const res = await handler(req);
    const body = await jsonBody(res);
    expect(body.ok).toBe(true);
    expect((body.data as unknown[]).length).toBe(1);
  });

  test("GET /tprm/vendors filters by tag", async () => {
    engine.registerVendor({
      name: "Cloud",
      domain: "cloud.com",
      did: "did:web:cloud.com",
      riskTier: "medium",
      tags: ["cloud"],
    });
    engine.registerVendor({
      name: "OnPrem",
      domain: "onprem.com",
      did: "did:web:onprem.com",
      riskTier: "medium",
      tags: ["on-prem"],
    });

    const req = jsonRequest("GET", "/tprm/vendors?tag=cloud", undefined, true);
    const res = await handler(req);
    const body = await jsonBody(res);
    expect(body.ok).toBe(true);
    expect((body.data as unknown[]).length).toBe(1);
  });

  test("DELETE /tprm/vendors returns 405 (not supported)", async () => {
    const req = jsonRequest("DELETE", "/tprm/vendors", undefined, true);
    const res = await handler(req);
    expect(res.status).toBe(405);
  });
});

// =============================================================================
// TPRM DASHBOARD ENDPOINT
// =============================================================================

describe("TPRM Dashboard Endpoint", () => {
  let handler: (req: Request) => Promise<Response>;
  let engine: TPRMEngine;

  beforeEach(() => {
    engine = new TPRMEngine();
    handler = createTPRMDashboardHandler({ engine });
  });

  test("GET /tprm/dashboard returns dashboard data", async () => {
    const req = jsonRequest("GET", "/tprm/dashboard", undefined, true);
    const res = await handler(req);
    expect(res.status).toBe(200);
    const body = await jsonBody(res);
    expect(body.ok).toBe(true);
    const data = body.data as Record<string, unknown>;
    expect(data.totalVendors).toBe(0);
    expect(data.byRiskTier).toBeDefined();
    expect(data.byDecision).toBeDefined();
    expect(data.averageScore).toBe(0);
  });

  test("GET /tprm/dashboard returns 405 for POST", async () => {
    const req = jsonRequest("POST", "/tprm/dashboard", {}, true);
    const res = await handler(req);
    expect(res.status).toBe(405);
  });

  test("GET /tprm/dashboard reflects registered vendors", async () => {
    engine.registerVendor({
      name: "Vendor A",
      domain: "a.com",
      did: "did:web:a.com",
      riskTier: "high",
      tags: [],
    });
    engine.registerVendor({
      name: "Vendor B",
      domain: "b.com",
      did: "did:web:b.com",
      riskTier: "low",
      tags: [],
    });

    const req = jsonRequest("GET", "/tprm/dashboard", undefined, true);
    const res = await handler(req);
    const body = await jsonBody(res);
    const data = body.data as Record<string, unknown>;
    expect(data.totalVendors).toBe(2);
  });

  test("GET /tprm/dashboard sets CORS headers", async () => {
    const req = jsonRequest("GET", "/tprm/dashboard", undefined, true);
    const res = await handler(req);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});

// =============================================================================
// WEBHOOKS ENDPOINT
// =============================================================================

describe("Webhooks Endpoint", () => {
  let handler: (req: Request) => Promise<Response>;
  let manager: WebhookManager;

  beforeEach(() => {
    manager = new WebhookManager();
    handler = createWebhooksHandler({ manager });
  });

  test("POST /webhooks registers a new endpoint", async () => {
    const req = jsonRequest("POST", "/webhooks", {
      url: "https://example.com/hooks",
      events: ["cpoe.signed", "cpoe.expired"],
    }, true);
    const res = await handler(req);
    expect(res.status).toBe(201);
    const body = await jsonBody(res);
    expect(body.ok).toBe(true);
    const data = body.data as Record<string, unknown>;
    expect(data.id).toBeDefined();
    expect(data.url).toBe("https://example.com/hooks");
    expect(data.active).toBe(true);
  });

  test("POST /webhooks returns 400 for missing url", async () => {
    const req = jsonRequest("POST", "/webhooks", {
      events: ["cpoe.signed"],
    }, true);
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  test("POST /webhooks returns 400 for missing events", async () => {
    const req = jsonRequest("POST", "/webhooks", {
      url: "https://example.com/hooks",
    }, true);
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  test("GET /webhooks lists registered endpoints", async () => {
    manager.registerEndpoint(
      "https://example.com/hooks",
      ["cpoe.signed"],
    );

    const req = jsonRequest("GET", "/webhooks", undefined, true);
    const res = await handler(req);
    expect(res.status).toBe(200);
    const body = await jsonBody(res);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect((body.data as unknown[]).length).toBe(1);
  });

  test("GET /webhooks returns empty list initially", async () => {
    const req = jsonRequest("GET", "/webhooks", undefined, true);
    const res = await handler(req);
    expect(res.status).toBe(200);
    const body = await jsonBody(res);
    expect(body.ok).toBe(true);
    expect((body.data as unknown[]).length).toBe(0);
  });

  test("DELETE /webhooks removes an endpoint", async () => {
    const ep = manager.registerEndpoint(
      "https://example.com/hooks",
      ["cpoe.signed"],
    );

    const req = jsonRequest("DELETE", "/webhooks", { id: ep.id }, true);
    const res = await handler(req);
    expect(res.status).toBe(200);
    const body = await jsonBody(res);
    expect(body.ok).toBe(true);
  });

  test("DELETE /webhooks returns 400 for missing id", async () => {
    const req = jsonRequest("DELETE", "/webhooks", {}, true);
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  test("DELETE /webhooks returns 404 for unknown id", async () => {
    const req = jsonRequest("DELETE", "/webhooks", { id: "nonexistent" }, true);
    const res = await handler(req);
    expect(res.status).toBe(404);
  });

  test("POST /webhooks with metadata passes it through", async () => {
    const req = jsonRequest("POST", "/webhooks", {
      url: "https://example.com/hooks",
      events: ["cpoe.signed"],
      metadata: { env: "production" },
    }, true);
    const res = await handler(req);
    expect(res.status).toBe(201);
    const body = await jsonBody(res);
    const data = body.data as Record<string, unknown>;
    const meta = data.metadata as Record<string, string>;
    expect(meta.env).toBe("production");
  });
});

// =============================================================================
// BILLING ENDPOINT
// =============================================================================

describe("Billing Endpoint", () => {
  let handler: (req: Request) => Promise<Response>;
  let manager: SubscriptionManager;

  beforeEach(() => {
    manager = new SubscriptionManager();
    handler = createBillingHandler({ manager });
  });

  test("GET /billing returns subscription + usage for an org", async () => {
    manager.createSubscription("org-1", "plan_free");

    const req = jsonRequest("GET", "/billing?orgId=org-1", undefined, true);
    const res = await handler(req);
    expect(res.status).toBe(200);
    const body = await jsonBody(res);
    expect(body.ok).toBe(true);
    const data = body.data as Record<string, unknown>;
    expect(data.subscription).toBeDefined();
    expect(data.usage).toBeDefined();
  });

  test("GET /billing returns 400 for missing orgId", async () => {
    const req = jsonRequest("GET", "/billing", undefined, true);
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  test("GET /billing returns 404 for unknown org", async () => {
    const req = jsonRequest("GET", "/billing?orgId=org-unknown", undefined, true);
    const res = await handler(req);
    expect(res.status).toBe(404);
  });

  test("POST /billing/subscribe creates a subscription", async () => {
    const req = jsonRequest("POST", "/billing/subscribe", {
      orgId: "org-new",
      planId: "plan_free",
    }, true);
    const res = await handler(req);
    expect(res.status).toBe(201);
    const body = await jsonBody(res);
    expect(body.ok).toBe(true);
    const data = body.data as Record<string, unknown>;
    expect(data.planId).toBe("plan_free");
    expect(data.status).toBe("active");
  });

  test("POST /billing/subscribe returns 400 for missing orgId", async () => {
    const req = jsonRequest("POST", "/billing/subscribe", {
      planId: "plan_free",
    }, true);
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  test("POST /billing/subscribe returns 400 for missing planId", async () => {
    const req = jsonRequest("POST", "/billing/subscribe", {
      orgId: "org-1",
    }, true);
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  test("POST /billing/subscribe returns 400 for invalid planId", async () => {
    const req = jsonRequest("POST", "/billing/subscribe", {
      orgId: "org-1",
      planId: "plan_nonexistent",
    }, true);
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  test("POST /billing/cancel cancels a subscription", async () => {
    manager.createSubscription("org-cancel", "plan_free");

    const req = jsonRequest("POST", "/billing/cancel", {
      orgId: "org-cancel",
    }, true);
    const res = await handler(req);
    expect(res.status).toBe(200);
    const body = await jsonBody(res);
    expect(body.ok).toBe(true);
    const data = body.data as Record<string, unknown>;
    expect(data.cancelAtPeriodEnd).toBe(true);
  });

  test("POST /billing/cancel returns 400 for missing orgId", async () => {
    const req = jsonRequest("POST", "/billing/cancel", {}, true);
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  test("POST /billing/cancel returns 404 for unknown org", async () => {
    const req = jsonRequest("POST", "/billing/cancel", {
      orgId: "org-nonexistent",
    }, true);
    const res = await handler(req);
    expect(res.status).toBe(404);
  });

  test("POST /billing/cancel with atPeriodEnd=false cancels immediately", async () => {
    manager.createSubscription("org-imm", "plan_pro");

    const req = jsonRequest("POST", "/billing/cancel", {
      orgId: "org-imm",
      atPeriodEnd: false,
    }, true);
    const res = await handler(req);
    expect(res.status).toBe(200);
    const body = await jsonBody(res);
    const data = body.data as Record<string, unknown>;
    expect(data.status).toBe("canceled");
  });

  test("billing endpoint sets CORS headers", async () => {
    manager.createSubscription("org-cors", "plan_free");
    const req = jsonRequest("GET", "/billing?orgId=org-cors", undefined, true);
    const res = await handler(req);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});

// =============================================================================
// RESPONSE ENVELOPE STRUCTURE (cross-cutting)
// =============================================================================

describe("Response Envelope Structure", () => {
  test("success responses have ok=true and data field", async () => {
    const engine = new TPRMEngine();
    const handler = createTPRMDashboardHandler({ engine });
    const req = jsonRequest("GET", "/tprm/dashboard", undefined, true);
    const res = await handler(req);
    const body = await jsonBody(res);
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.error).toBeUndefined();
  });

  test("error responses have ok=false and error field", async () => {
    const handler = createAuditHandler();
    const req = jsonRequest("POST", "/audit", {}, true);
    const res = await handler(req);
    const body = await jsonBody(res);
    expect(body.ok).toBe(false);
    expect(body.error).toBeDefined();
    const error = body.error as Record<string, unknown>;
    expect(error.code).toBeDefined();
    expect(error.message).toBeDefined();
  });

  test("405 errors have correct envelope format", async () => {
    const engine = new CertificationEngine();
    const handler = createCertCreateHandler({ engine });
    const req = jsonRequest("GET", "/cert", undefined, true);
    const res = await handler(req);
    expect(res.status).toBe(405);
    const body = await jsonBody(res);
    expect(body.ok).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe("method_not_allowed");
  });
});
