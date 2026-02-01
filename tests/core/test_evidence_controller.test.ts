/**
 * Tests for Evidence Controller
 *
 * Verifies core-controlled evidence writes to maintain hash chain integrity.
 *
 * Key Principle: Plugins PROPOSE evidence, Core WRITES evidence.
 * This separation ensures:
 * - Single writer for hash chain (prevents races)
 * - Cryptographic integrity (hash chain unbroken)
 * - Audit trail (all events routed through one controller)
 *
 * TDD Approach: Writing tests FIRST to define the contract
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, rmSync, readFileSync } from "fs";
import { EvidenceController } from "../../src/core/evidence-controller";
import type { PluginRaidResult } from "../../src/types/provider-plugin";

const TEST_EVIDENCE_PATH = "/tmp/corsair-test-evidence.jsonl";

beforeEach(() => {
  // Clean up test evidence file
  if (existsSync(TEST_EVIDENCE_PATH)) {
    rmSync(TEST_EVIDENCE_PATH, { force: true });
  }
});

afterEach(() => {
  // Clean up test evidence file
  if (existsSync(TEST_EVIDENCE_PATH)) {
    rmSync(TEST_EVIDENCE_PATH, { force: true });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CRITERION 1: Evidence controller wraps plugin results
// ═══════════════════════════════════════════════════════════════════════════════

describe("EvidenceController - Plugin Integration", () => {
  it("should record plugin raid result with hash chain", async () => {
    const controller = new EvidenceController(TEST_EVIDENCE_PATH);

    const pluginResult: PluginRaidResult = {
      findings: ["MFA bypass successful"],
      timeline: [
        { timestamp: new Date().toISOString(), action: "CHECK_MFA", result: "OFF" }
      ],
      success: true,
      controlsHeld: false,
      proposedEvidence: { testField: "plugin-specific-data" }
    };

    const result = await controller.recordPluginRaid(
      "aws-cognito",
      "us-east-1_ABC123",
      "mfa-bypass",
      pluginResult
    );

    expect(result.evidencePath).toBe(TEST_EVIDENCE_PATH);
    expect(result.eventCount).toBeGreaterThan(0);
    expect(result.chainVerified).toBe(true);
    expect(result.auditReady).toBe(true);
  });

  it("should include provider and plugin-proposed evidence", async () => {
    const controller = new EvidenceController(TEST_EVIDENCE_PATH);

    const pluginResult: PluginRaidResult = {
      findings: ["Test finding"],
      timeline: [],
      success: false,
      controlsHeld: true,
      proposedEvidence: { customField: "value", nestedObj: { a: 1 } }
    };

    await controller.recordPluginRaid(
      "test-provider",
      "target-123",
      "test-attack",
      pluginResult
    );

    // Read JSONL and verify structure
    const content = readFileSync(TEST_EVIDENCE_PATH, "utf-8");
    const records = content.trim().split("\n").map(line => JSON.parse(line));

    // Should have provider info and plugin evidence
    const hasProvider = records.some((r: any) =>
      r.data?.provider === "test-provider"
    );

    const hasPluginEvidence = records.some((r: any) =>
      r.data?.pluginEvidence?.customField === "value"
    );

    expect(hasProvider).toBe(true);
    expect(hasPluginEvidence).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CRITERION 2: Plugins never write directly (contract enforcement)
// ═══════════════════════════════════════════════════════════════════════════════

describe("EvidenceController - Single Writer Pattern", () => {
  it("should be the sole writer to evidence file", async () => {
    const controller = new EvidenceController(TEST_EVIDENCE_PATH);

    // Before any writes, file shouldn't exist
    expect(existsSync(TEST_EVIDENCE_PATH)).toBe(false);

    // Controller writes
    await controller.recordPluginRaid(
      "provider",
      "target",
      "vector",
      {
        findings: [],
        timeline: [],
        success: false,
        controlsHeld: true
      }
    );

    // Now file exists (controller created it)
    expect(existsSync(TEST_EVIDENCE_PATH)).toBe(true);

    // Content should have proper JSONL + hash chain structure
    const content = readFileSync(TEST_EVIDENCE_PATH, "utf-8");
    const lines = content.trim().split("\n");

    // Each line should be valid JSON
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }

    // Each record should have hash chain fields
    const records = lines.map(line => JSON.parse(line));
    for (const record of records) {
      expect(record).toHaveProperty("sequence");
      expect(record).toHaveProperty("timestamp");
      expect(record).toHaveProperty("operation");
      expect(record).toHaveProperty("previousHash");
      expect(record).toHaveProperty("hash");
    }
  });

  it("should maintain sequence numbers across raids", async () => {
    const controller = new EvidenceController(TEST_EVIDENCE_PATH);

    // Record two raids
    await controller.recordPluginRaid("p1", "t1", "v1", {
      findings: [],
      timeline: [],
      success: false,
      controlsHeld: true
    });

    await controller.recordPluginRaid("p2", "t2", "v2", {
      findings: [],
      timeline: [],
      success: true,
      controlsHeld: false
    });

    // Read all records
    const content = readFileSync(TEST_EVIDENCE_PATH, "utf-8");
    const records = content.trim().split("\n").map(line => JSON.parse(line));

    // Sequences should be monotonically increasing
    const sequences = records.map((r: any) => r.sequence);
    for (let i = 1; i < sequences.length; i++) {
      expect(sequences[i]).toBeGreaterThan(sequences[i - 1]);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CRITERION 3: Hash chain integrity maintained
// ═══════════════════════════════════════════════════════════════════════════════

describe("EvidenceController - Hash Chain", () => {
  it("should create valid hash chain linking all records", async () => {
    const controller = new EvidenceController(TEST_EVIDENCE_PATH);

    // Write multiple raids
    for (let i = 1; i <= 3; i++) {
      await controller.recordPluginRaid(`provider-${i}`, `target-${i}`, "vector", {
        findings: [`Finding ${i}`],
        timeline: [],
        success: false,
        controlsHeld: true
      });
    }

    // Verify chain
    const verification = controller.verifyChain();

    expect(verification.valid).toBe(true);
    expect(verification.brokenAt).toBeNull();
    expect(verification.recordCount).toBeGreaterThan(0);
  });

  it("should detect tampered hash chain", async () => {
    const controller = new EvidenceController(TEST_EVIDENCE_PATH);

    await controller.recordPluginRaid("p1", "t1", "v1", {
      findings: [],
      timeline: [],
      success: false,
      controlsHeld: true
    });

    await controller.recordPluginRaid("p2", "t2", "v2", {
      findings: [],
      timeline: [],
      success: false,
      controlsHeld: true
    });

    // Tamper with evidence file (modify a hash)
    let content = readFileSync(TEST_EVIDENCE_PATH, "utf-8");
    const lines = content.trim().split("\n");
    const records = lines.map(line => JSON.parse(line));

    if (records.length > 1) {
      // Tamper with second record's hash
      records[1].hash = "TAMPERED_HASH_0000000000000000000000000000000000000000000000000000000000000000";

      // Write back
      const tamperedContent = records.map(r => JSON.stringify(r)).join("\n") + "\n";
      rmSync(TEST_EVIDENCE_PATH, { force: true });
      require("fs").writeFileSync(TEST_EVIDENCE_PATH, tamperedContent);

      // Verification should fail
      const verification = controller.verifyChain();
      expect(verification.valid).toBe(false);
      expect(verification.brokenAt).not.toBeNull();
    }
  });

  it("should link each record to previous via previousHash", async () => {
    const controller = new EvidenceController(TEST_EVIDENCE_PATH);

    await controller.recordPluginRaid("p1", "t1", "v1", {
      findings: [],
      timeline: [],
      success: false,
      controlsHeld: true
    });

    await controller.recordPluginRaid("p2", "t2", "v2", {
      findings: [],
      timeline: [],
      success: false,
      controlsHeld: true
    });

    // Read records
    const content = readFileSync(TEST_EVIDENCE_PATH, "utf-8");
    const records = content.trim().split("\n").map(line => JSON.parse(line));

    // First record should have null previousHash
    expect(records[0].previousHash).toBeNull();

    // Each subsequent record's previousHash should match previous record's hash
    for (let i = 1; i < records.length; i++) {
      expect(records[i].previousHash).toBe(records[i - 1].hash);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CRITERION 4: Audit-ready JSONL format
// ═══════════════════════════════════════════════════════════════════════════════

describe("EvidenceController - JSONL Format", () => {
  it("should produce valid JSONL (one JSON object per line)", async () => {
    const controller = new EvidenceController(TEST_EVIDENCE_PATH);

    await controller.recordPluginRaid("p1", "t1", "v1", {
      findings: ["Finding 1", "Finding 2"],
      timeline: [],
      success: false,
      controlsHeld: true
    });

    const content = readFileSync(TEST_EVIDENCE_PATH, "utf-8");
    const lines = content.trim().split("\n");

    // Each line should be valid JSON
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }

    // Should NOT be a JSON array (that would be .json, not .jsonl)
    expect(content.trim().startsWith("[")).toBe(false);
  });

  it("should include ISO timestamps in all records", async () => {
    const controller = new EvidenceController(TEST_EVIDENCE_PATH);

    await controller.recordPluginRaid("p1", "t1", "v1", {
      findings: [],
      timeline: [],
      success: false,
      controlsHeld: true
    });

    const content = readFileSync(TEST_EVIDENCE_PATH, "utf-8");
    const records = content.trim().split("\n").map(line => JSON.parse(line));

    // All records should have ISO timestamps
    for (const record of records) {
      expect(record.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CRITERION 5: Evidence controller is provider-agnostic
// ═══════════════════════════════════════════════════════════════════════════════

describe("EvidenceController - Provider Agnostic", () => {
  it("should handle evidence from any provider", async () => {
    const controller = new EvidenceController(TEST_EVIDENCE_PATH);

    const providers = ["aws-cognito", "okta", "auth0", "azure-ad", "custom-provider"];

    // Record raids from different providers
    for (const provider of providers) {
      await controller.recordPluginRaid(provider, `${provider}-target`, "test", {
        findings: [`${provider} finding`],
        timeline: [],
        success: false,
        controlsHeld: true
      });
    }

    // All should be recorded
    const content = readFileSync(TEST_EVIDENCE_PATH, "utf-8");
    const records = content.trim().split("\n").map(line => JSON.parse(line));

    const recordedProviders = new Set(
      records.map((r: any) => r.data?.provider).filter(Boolean)
    );

    // All providers should be present
    for (const provider of providers) {
      expect(recordedProviders.has(provider)).toBe(true);
    }

    // Chain should still be valid
    const verification = controller.verifyChain();
    expect(verification.valid).toBe(true);
  });
});
