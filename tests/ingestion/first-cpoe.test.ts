import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

import { MarqueGenerator } from "../../src/parley/marque-generator";
import { MarqueVerifier } from "../../src/parley/marque-verifier";
import { MarqueKeyManager } from "../../src/parley/marque-key-manager";
import { mapToMarqueInput } from "../../src/ingestion/mapper";
import type { IngestedDocument } from "../../src/ingestion/types";

// =============================================================================
// FIXTURE: Simulated SOC 2 extraction
// =============================================================================

const sampleSOC2: IngestedDocument = {
  source: "soc2",
  metadata: {
    title: "Acme Corp SOC 2 Type II Report — FY2025",
    issuer: "Acme Corp",
    date: "2026-01-15",
    scope: "Cloud infrastructure security controls for SaaS platform",
    auditor: "Independent Audit Firm LLP",
    reportType: "SOC 2 Type II",
  },
  controls: [
    {
      id: "CC6.1-mfa",
      description: "Multi-factor authentication enforced for all user accounts",
      status: "effective",
      severity: "CRITICAL",
      assuranceLevel: 2,
      evidence: "Pen test confirmed MFA blocks unauthenticated access on 2026-01-10",
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC6.1", controlName: "Logical Access Security" },
        { framework: "NIST-800-53", controlId: "IA-2", controlName: "Identification and Authentication" },
        { framework: "ISO27001", controlId: "A.8.5", controlName: "Secure Authentication" },
      ],
    },
    {
      id: "CC6.1-encryption",
      description: "Data at rest encrypted using AES-256",
      status: "effective",
      severity: "CRITICAL",
      assuranceLevel: 1,
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC6.1" },
        { framework: "NIST-800-53", controlId: "SC-28", controlName: "Protection of Information at Rest" },
      ],
    },
    {
      id: "CC6.6-network",
      description: "Network segmentation between production and development",
      status: "effective",
      severity: "HIGH",
      assuranceLevel: 1,
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC6.6", controlName: "System Boundaries" },
        { framework: "NIST-800-53", controlId: "SC-7", controlName: "Boundary Protection" },
      ],
    },
    {
      id: "CC7.2-logging",
      description: "Centralized security event logging with 90-day retention",
      status: "effective",
      severity: "HIGH",
      assuranceLevel: 1,
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC7.2", controlName: "System Monitoring" },
        { framework: "NIST-800-53", controlId: "AU-6", controlName: "Audit Record Review" },
      ],
    },
    {
      id: "CC8.1-change",
      description: "Change management process with peer review for all production deployments",
      status: "effective",
      severity: "MEDIUM",
      assuranceLevel: 2,
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC8.1", controlName: "Change Management" },
        { framework: "NIST-800-53", controlId: "CM-3", controlName: "Configuration Change Control" },
      ],
    },
    {
      id: "CC6.3-rbac",
      description: "Role-based access control with quarterly access reviews",
      status: "ineffective",
      severity: "HIGH",
      assuranceLevel: 1,
      evidence: "Last access review was 8 months ago, exceeding quarterly requirement",
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC6.3", controlName: "Role-Based Access" },
        { framework: "NIST-800-53", controlId: "AC-2", controlName: "Account Management" },
      ],
    },
  ],
  assessmentContext: {
    techStack: [
      { component: "Primary IdP", technology: "Okta", scope: "All 3,200 employees via SSO" },
      { component: "Customer auth", technology: "AWS Cognito", scope: "45,000 customer accounts" },
      { component: "Infrastructure", technology: "AWS (us-east-1, us-west-2)", scope: "Production + staging" },
    ],
    compensatingControls: [
      {
        description: "Okta provides MFA for employee access instead of per-service MFA",
        rationale: "Okta is the central IdP. Per-service MFA would create friction without security benefit.",
        acceptedBy: "CISO",
      },
    ],
    gaps: [
      "VPN access MFA not evidenced in this assessment",
      "Service account authentication uses API keys, not MFA",
      "Third-party SaaS integrations not in scope",
    ],
    scopeCoverage: "85% of interactive user accounts, 100% of production infrastructure",
  },
};

// =============================================================================
// TESTS
// =============================================================================

describe("First CPOE Generation — End-to-End", () => {
  let keyManager: MarqueKeyManager;
  const testKeyDir = path.join(process.cwd(), ".test-keys-ingestion-" + crypto.randomUUID().slice(0, 8));

  beforeAll(async () => {
    keyManager = new MarqueKeyManager(testKeyDir);
    await keyManager.generateKeypair();
  });

  afterAll(() => {
    // Cleanup test keys
    if (fs.existsSync(testKeyDir)) {
      fs.rmSync(testKeyDir, { recursive: true });
    }
  });

  test("should generate a JWT-VC CPOE from an ingested SOC 2 document", async () => {
    // Map ingested document → MarqueGeneratorInput
    const input = mapToMarqueInput(sampleSOC2, { did: "did:web:acme.com" });

    // Generate CPOE as JWT-VC
    const generator = new MarqueGenerator(keyManager, {
      expiryDays: 90,
      format: "vc",
    });

    const output = await generator.generateOutput(input);

    expect(output.format).toBe("vc");
    expect(output.jwt).toBeDefined();
    expect(output.jwt!.split(".")).toHaveLength(3); // JWT has 3 parts
    expect(output.marqueId).toMatch(/^marque-/);
  });

  test("should generate a JSON envelope CPOE from an ingested document", async () => {
    const input = mapToMarqueInput(sampleSOC2);

    const generator = new MarqueGenerator(keyManager, {
      expiryDays: 90,
      format: "v1",
    });

    const output = await generator.generateOutput(input);

    expect(output.format).toBe("v1");
    expect(output.v1).toBeDefined();
    expect(output.v1!.parley).toBe("1.0");
    expect(output.v1!.signature).toBeDefined();
    expect(output.v1!.marque.summary.controlsTested).toBeGreaterThan(0);
  });

  test("should produce a verifiable JSON envelope CPOE", async () => {
    const input = mapToMarqueInput(sampleSOC2);

    const generator = new MarqueGenerator(keyManager, {
      expiryDays: 90,
      format: "v1",
    });

    const output = await generator.generateOutput(input);
    const keypair = await keyManager.loadKeypair();

    // Verify with MarqueVerifier
    const verifier = new MarqueVerifier([keypair!.publicKey]);
    const result = await verifier.verify(output.v1!);

    expect(result.valid).toBe(true);
  });

  test("should produce a verifiable JWT-VC CPOE", async () => {
    const input = mapToMarqueInput(sampleSOC2, { did: "did:web:acme.com" });

    const generator = new MarqueGenerator(keyManager, {
      expiryDays: 90,
      format: "vc",
    });

    const output = await generator.generateOutput(input);
    const keypair = await keyManager.loadKeypair();

    // Verify JWT-VC with MarqueVerifier
    const verifier = new MarqueVerifier([keypair!.publicKey]);
    const result = await verifier.verify(output.jwt!);

    expect(result.valid).toBe(true);
  });

  test("should capture framework coverage in the CPOE", async () => {
    const input = mapToMarqueInput(sampleSOC2);

    const generator = new MarqueGenerator(keyManager, {
      expiryDays: 90,
      format: "v1",
    });

    const output = await generator.generateOutput(input);
    const marque = output.v1!.marque;

    // Should have frameworks from the SOC 2 controls
    expect(marque.frameworks).toBeDefined();
    expect(Object.keys(marque.frameworks)).toContain("SOC2");
    expect(Object.keys(marque.frameworks)).toContain("NIST-800-53");
    expect(Object.keys(marque.frameworks)).toContain("ISO27001");

    // SOC2 should have multiple controls
    const soc2 = marque.frameworks["SOC2"];
    expect(soc2.controlsMapped).toBeGreaterThanOrEqual(4);
    expect(soc2.passed).toBeGreaterThan(0);
    expect(soc2.failed).toBeGreaterThan(0); // CC6.3-rbac is ineffective
  });

  test("should reflect pass/fail ratio in summary", async () => {
    const input = mapToMarqueInput(sampleSOC2);

    const generator = new MarqueGenerator(keyManager, {
      expiryDays: 90,
      format: "v1",
    });

    const output = await generator.generateOutput(input);
    const summary = output.v1!.marque.summary;

    // 6 controls total, 5 effective + 1 ineffective
    // But summary counts per-framework controls (some controls map to multiple frameworks)
    expect(summary.controlsTested).toBeGreaterThan(0);
    expect(summary.controlsPassed).toBeGreaterThan(0);
    expect(summary.controlsFailed).toBeGreaterThan(0);
    expect(summary.overallScore).toBeGreaterThan(0);
    expect(summary.overallScore).toBeLessThan(100);
  });

  test("should set correct scope metadata", async () => {
    const input = mapToMarqueInput(sampleSOC2);

    const generator = new MarqueGenerator(keyManager, {
      expiryDays: 90,
      format: "v1",
    });

    const output = await generator.generateOutput(input);
    const scope = output.v1!.marque.scope;

    expect(scope.providers).toContain("soc2-document");
    expect(scope.frameworksCovered).toContain("SOC2");
    expect(scope.frameworksCovered).toContain("NIST-800-53");
    expect(scope.resourceCount).toBeGreaterThan(0);
  });
});
