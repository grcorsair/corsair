import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, rmSync, mkdirSync } from "fs";
import { MarqueKeyManager } from "../../src/parley/marque-key-manager";
import { MarqueGenerator } from "../../src/parley/marque-generator";
import { MarqueVerifier } from "../../src/parley/marque-verifier";
import { mapToMarqueInput } from "../../src/ingestion/mapper";
import type { IngestedDocument } from "../../src/ingestion/types";

const TEST_DIR = "/tmp/corsair-integration-test";
const KEY_DIR = `${TEST_DIR}/keys`;

describe("Ingestion -> CPOE E2E Flow", () => {
  let keyManager: MarqueKeyManager;
  let publicKey: Buffer;

  beforeAll(async () => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(KEY_DIR, { recursive: true });
    keyManager = new MarqueKeyManager(KEY_DIR);
    const keypair = await keyManager.generateKeypair();
    publicKey = keypair.publicKey;
  });

  afterAll(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  test("IngestedDocument -> MarqueInput -> MARQUE -> Verify (JSON)", async () => {
    const doc: IngestedDocument = {
      source: "soc2",
      metadata: {
        title: "Acme Corp SOC 2 Type II",
        issuer: "Acme Corp",
        date: "2026-01-15",
        scope: "Cloud infrastructure",
        auditor: "Big4 Firm",
        reportType: "SOC 2 Type II",
      },
      controls: [
        {
          id: "CC6.1",
          description: "Logical access security controls",
          status: "effective",
          severity: "CRITICAL",
          frameworkRefs: [
            { framework: "SOC2", controlId: "CC6.1", controlName: "Logical Access" },
            { framework: "NIST-800-53", controlId: "AC-2", controlName: "Account Management" },
          ],
          evidence: "MFA enforced for all users via Okta SSO",
        },
        {
          id: "CC6.3",
          description: "Role-based access control",
          status: "effective",
          severity: "HIGH",
          frameworkRefs: [
            { framework: "SOC2", controlId: "CC6.3", controlName: "RBAC" },
          ],
          evidence: "RBAC policy reviewed quarterly",
        },
        {
          id: "CC7.2",
          description: "Vulnerability management",
          status: "ineffective",
          severity: "HIGH",
          frameworkRefs: [
            { framework: "SOC2", controlId: "CC7.2", controlName: "Vulnerability Mgmt" },
          ],
          evidence: "Patch cycle exceeded 30-day SLA",
        },
      ],
    };

    // Map to MarqueGeneratorInput
    const input = mapToMarqueInput(doc, {
      did: "did:web:acme.com",
      organization: "Acme Corp",
    });

    expect(input.markResults.length).toBe(1);
    expect(input.markResults[0].findings.length).toBe(3);
    expect(input.chartResults.length).toBe(1);
    expect(input.providers).toEqual(["soc2-document"]);

    // Generate MARQUE (JSON envelope)
    const generator = new MarqueGenerator(keyManager, { format: "v1" });
    const marque = await generator.generate(input);

    expect(marque.parley).toBe("1.0");
    expect(marque.marque.id).toBeDefined();
    expect(marque.signature).toBeDefined();

    // Verify
    const verifier = new MarqueVerifier([publicKey]);
    const verification = await verifier.verify(marque);
    expect(verification.valid).toBe(true);
  });

  test("IngestedDocument -> MarqueInput -> JWT-VC -> Verify", async () => {
    const doc: IngestedDocument = {
      source: "soc2",
      metadata: {
        title: "Simple SOC 2 Report",
        issuer: "Test Corp",
        date: "2026-02-01",
        scope: "Auth system",
      },
      controls: [
        {
          id: "CC6.1",
          description: "MFA enabled",
          status: "effective",
          frameworkRefs: [{ framework: "SOC2", controlId: "CC6.1" }],
        },
      ],
    };

    const input = mapToMarqueInput(doc, { did: "did:web:test.com" });

    // Generate JWT-VC
    const generator = new MarqueGenerator(keyManager, { format: "vc" });
    const output = await generator.generateOutput(input);

    expect(output.format).toBe("vc");
    expect(output.jwt).toBeDefined();
    expect(output.jwt!.startsWith("eyJ")).toBe(true);

    // Verify JWT-VC
    const verifier = new MarqueVerifier([publicKey]);
    const verification = await verifier.verify(output.jwt!);
    expect(verification.valid).toBe(true);
  });

  test("Tampered MARQUE fails verification", async () => {
    const doc: IngestedDocument = {
      source: "soc2",
      metadata: {
        title: "Tamper Test",
        issuer: "Test Corp",
        date: "2026-02-01",
        scope: "Test",
      },
      controls: [
        { id: "CC6.1", description: "Test control", status: "effective" },
      ],
    };

    const input = mapToMarqueInput(doc);
    const generator = new MarqueGenerator(keyManager, { format: "v1" });
    const marque = await generator.generate(input);

    // Tamper
    const tampered = JSON.parse(JSON.stringify(marque));
    tampered.marque.summary.overallScore = 999;

    const verifier = new MarqueVerifier([publicKey]);
    const result = await verifier.verify(tampered);
    expect(result.valid).toBe(false);
  });
});
