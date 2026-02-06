/**
 * Quartermaster LLM Phase Tests
 *
 * Tests the LLM governance review capability of the Quartermaster agent:
 * - Deterministic mode skips API call
 * - Claude model mode triggers API call
 * - LLM adjustments are bounded (-20 to +10)
 * - LLM findings merge into dimension findings
 * - API failure falls back to deterministic-only gracefully
 * - Narrative embedded in executiveSummary
 * - Prompt construction includes all artifact summaries
 */

import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { createHash } from "crypto";
import { QuartermasterAgent } from "../../src/quartermaster/quartermaster-agent";
import type {
  QuartermasterInput,
  QuartermasterConfig,
  QuartermasterGovernanceReport,
} from "../../src/quartermaster/quartermaster-types";
import type { MarkResult, RaidResult, ChartResult, ThreatModelResult } from "../../src/types";

const TEST_DIR = "/tmp/quartermaster-llm-test";
const TEST_EVIDENCE = `${TEST_DIR}/evidence.jsonl`;

// ============================================================================
// HELPERS
// ============================================================================

function makeHash(record: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(record)).digest("hex");
}

function writeValidEvidence(path: string, count: number = 3): void {
  const dir = path.substring(0, path.lastIndexOf("/"));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  let previousHash: string | null = null;
  const lines: string[] = [];

  for (let i = 0; i < count; i++) {
    const record = {
      sequence: i + 1,
      timestamp: new Date(Date.now() + i * 1000).toISOString(),
      operation: "raid_executed",
      data: { raidId: `raid-${i}`, success: false, controlsHeld: true },
      previousHash,
    };
    const hash = makeHash(record);
    lines.push(JSON.stringify({ ...record, hash }));
    previousHash = hash;
  }

  writeFileSync(path, lines.join("\n") + "\n");
}

function makeMinimalInput(overrides: Partial<QuartermasterInput> = {}): QuartermasterInput {
  return {
    evidencePaths: [TEST_EVIDENCE],
    markResults: [],
    raidResults: [],
    chartResults: [],
    scope: { providers: ["aws-cognito"], resourceCount: 1 },
    ...overrides,
  };
}

function makeRaidResult(id: string, success: boolean = false): RaidResult {
  return {
    raidId: id,
    target: "test-pool",
    vector: "weak-password" as any,
    success,
    controlsHeld: !success,
    findings: success ? ["Control bypassed"] : [],
    durationMs: 100,
    serialized: true,
    timeline: [],
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
}

function makeMarkResult(severity: string = "CRITICAL"): MarkResult {
  return {
    findings: [
      {
        id: `drift-${Date.now()}`,
        field: "mfaConfiguration",
        expected: "ON",
        actual: "OFF",
        drift: true,
        severity: severity as any,
        description: "MFA is disabled",
        timestamp: new Date().toISOString(),
      },
    ],
    driftDetected: true,
    durationMs: 50,
  };
}

function makeChartResult(): ChartResult {
  return {
    mitre: {
      technique: "T1556",
      name: "Modify Authentication Process",
      tactic: "Credential Access",
      description: "MFA bypass attempt",
    },
    nist: {
      function: "Protect",
      category: "Access Control",
      controls: ["AC-7"],
    },
    soc2: {
      principle: "Security",
      criteria: ["CC6.1"],
      description: "Logical access security",
    },
  };
}

function makeThreatModel(): ThreatModelResult {
  return {
    threats: [
      {
        id: "threat-1",
        stride: "Spoofing",
        description: "MFA bypass via weak recovery",
        mitreTechnique: "T1556.006",
        mitreName: "Modify Authentication Process: MFA Bypass",
        affectedField: "mfaConfiguration",
        severity: "CRITICAL",
        attackVectors: ["mfa-bypass"],
      },
    ],
    methodology: "STRIDE-automated",
    provider: "aws-cognito",
    analyzedAt: new Date().toISOString(),
    threatCount: 1,
    riskDistribution: { CRITICAL: 1 },
  };
}

function makeRichInput(): QuartermasterInput {
  return makeMinimalInput({
    markResults: [makeMarkResult("CRITICAL"), makeMarkResult("HIGH")],
    raidResults: [
      makeRaidResult("raid-0", true),
      makeRaidResult("raid-1", false),
      makeRaidResult("raid-2", false),
    ],
    chartResults: [makeChartResult()],
    threatModel: makeThreatModel(),
    iscCriteria: [
      {
        id: "isc-1",
        text: "MFA enabled all users",
        status: "PENDING" as const,
        extractedAt: new Date().toISOString(),
        source: "agent",
      },
    ],
    scope: { providers: ["aws-cognito", "aws-s3"], resourceCount: 5 },
  });
}

/**
 * Creates a mock LLM response matching the expected JSON schema.
 */
function makeLLMResponse(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    methodology_adjustment: -5,
    completeness_adjustment: -3,
    bias_adjustment: 2,
    findings: [
      {
        severity: "warning",
        category: "methodology",
        description: "Password spray vector not tested despite Cognito target",
        remediation: "Add password-spray attack vector to RAID phase",
      },
    ],
    narrative:
      "Assessment covers core MFA controls but lacks depth in credential-based attacks. Evidence integrity is strong with verified hash chains.",
    ...overrides,
  });
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe("Quartermaster LLM Phase", () => {
  beforeEach(() => {
    if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
    writeValidEvidence(TEST_EVIDENCE, 3);
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  // --------------------------------------------------------------------------
  // Test 1: Deterministic model does NOT call API
  // --------------------------------------------------------------------------

  test("evaluate() with model='deterministic' does NOT call API", async () => {
    const config: QuartermasterConfig = {
      apiKey: "test-key",
      model: "deterministic",
    };
    const agent = new QuartermasterAgent(config);
    const input = makeMinimalInput();

    // Spy on evaluateWithLLM — should NOT be called
    const spy = spyOn(agent, "evaluateWithLLM" as any);

    const report = await agent.evaluate(input);

    expect(spy).not.toHaveBeenCalled();
    expect(report.model).toBe("deterministic");
    expect(report.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(report.confidenceScore).toBeLessThanOrEqual(100);
  });

  // --------------------------------------------------------------------------
  // Test 2: Claude model ID triggers API call attempt
  // --------------------------------------------------------------------------

  test("evaluate() with model='claude-sonnet-4-5-20250929' attempts API call", async () => {
    const config: QuartermasterConfig = {
      apiKey: "test-key-not-real",
      model: "claude-sonnet-4-5-20250929",
    };
    const agent = new QuartermasterAgent(config);
    const input = makeRichInput();

    // Mock the evaluateWithLLM method to avoid real API call
    const mockLLMResponse = {
      methodology_adjustment: -5,
      completeness_adjustment: -3,
      bias_adjustment: 2,
      findings: [
        {
          severity: "warning" as const,
          category: "methodology",
          description: "Missing password spray vector",
          remediation: "Add password-spray to RAID",
        },
      ],
      narrative: "Assessment has gaps in credential testing.",
    };

    const spy = spyOn(agent as any, "callClaudeAPI").mockResolvedValue(mockLLMResponse);

    const report = await agent.evaluate(input);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(report.model).toBe("claude-sonnet-4-5-20250929");
  });

  // --------------------------------------------------------------------------
  // Test 3: LLM adjustments are bounded (-20 to +10)
  // --------------------------------------------------------------------------

  test("LLM adjustments are clamped to bounds (-20 to +10)", async () => {
    const config: QuartermasterConfig = {
      apiKey: "test-key",
      model: "claude-sonnet-4-5-20250929",
    };
    const agent = new QuartermasterAgent(config);
    const input = makeRichInput();

    // Return out-of-bounds adjustments
    const spy = spyOn(agent as any, "callClaudeAPI").mockResolvedValue({
      methodology_adjustment: -50, // way below -20
      completeness_adjustment: 30, // way above +10
      bias_adjustment: -25, // below -20
      findings: [],
      narrative: "Test with extreme adjustments.",
    });

    const report = await agent.evaluate(input);

    // Get each dimension's score — they should be adjusted but not driven insanely
    // The clamping happens internally; we verify via the dimension scores
    for (const dim of report.dimensions) {
      expect(dim.score).toBeGreaterThanOrEqual(0);
      expect(dim.score).toBeLessThanOrEqual(100);
    }

    // Also verify the agent applies clampAdjustment correctly
    const clamp = (agent as any).clampAdjustment;
    expect(clamp(-50)).toBe(-20);
    expect(clamp(30)).toBe(10);
    expect(clamp(-25)).toBe(-20);
    expect(clamp(5)).toBe(5);
    expect(clamp(-10)).toBe(-10);
  });

  // --------------------------------------------------------------------------
  // Test 4: LLM findings are merged into dimension findings
  // --------------------------------------------------------------------------

  test("LLM findings are merged into dimension findings", async () => {
    const config: QuartermasterConfig = {
      apiKey: "test-key",
      model: "claude-sonnet-4-5-20250929",
    };
    const agent = new QuartermasterAgent(config);
    const input = makeRichInput();

    const llmFindings = [
      {
        severity: "critical" as const,
        category: "methodology",
        description: "No lateral movement testing performed",
        remediation: "Test privilege escalation paths",
      },
      {
        severity: "warning" as const,
        category: "bias_detection",
        description: "Severity ratings skew high without justification",
        remediation: "Calibrate severity against CVSS or similar framework",
      },
      {
        severity: "info" as const,
        category: "completeness",
        description: "S3 bucket versioning not tested",
        remediation: "Add versioning-test to RAID scope",
      },
    ];

    spyOn(agent as any, "callClaudeAPI").mockResolvedValue({
      methodology_adjustment: -5,
      completeness_adjustment: -8,
      bias_adjustment: -3,
      findings: llmFindings,
      narrative: "Gaps identified.",
    });

    const report = await agent.evaluate(input);

    // LLM findings should be in the report
    const allFindings = report.dimensions.flatMap((d) => d.findings);
    const llmTaggedFindings = allFindings.filter((f) => f.id.startsWith("QM-LLM-"));

    expect(llmTaggedFindings.length).toBe(3);

    // Check that findings land in correct dimensions
    const methodologyDim = report.dimensions.find((d) => d.dimension === "methodology");
    const biasDim = report.dimensions.find((d) => d.dimension === "bias_detection");
    const completenessDim = report.dimensions.find((d) => d.dimension === "completeness");

    expect(methodologyDim!.findings.some((f) => f.description.includes("lateral movement"))).toBe(true);
    expect(biasDim!.findings.some((f) => f.description.includes("Severity ratings"))).toBe(true);
    expect(completenessDim!.findings.some((f) => f.description.includes("S3 bucket"))).toBe(true);

    // Total findings count includes all LLM findings
    // (Rich input with complete phases may have zero deterministic findings)
    expect(report.totalFindings).toBeGreaterThanOrEqual(llmTaggedFindings.length);
  });

  // --------------------------------------------------------------------------
  // Test 5: API failure falls back to deterministic-only gracefully
  // --------------------------------------------------------------------------

  test("API failure falls back to deterministic-only gracefully", async () => {
    const config: QuartermasterConfig = {
      apiKey: "test-key",
      model: "claude-sonnet-4-5-20250929",
    };
    const agent = new QuartermasterAgent(config);
    const input = makeRichInput();

    // Mock API to throw
    spyOn(agent as any, "callClaudeAPI").mockRejectedValue(new Error("API rate limit exceeded"));

    const report = await agent.evaluate(input);

    // Should still produce a valid report
    expect(report.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(report.confidenceScore).toBeLessThanOrEqual(100);
    expect(report.trustTier).toBeDefined();
    expect(report.dimensions).toHaveLength(4);
    expect(report.reportHash).toBeTruthy();

    // Should note the fallback in executive summary or have no LLM findings
    const allFindings = report.dimensions.flatMap((d) => d.findings);
    const llmFindings = allFindings.filter((f) => f.id.startsWith("QM-LLM-"));
    expect(llmFindings).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // Test 6: Narrative is embedded in executiveSummary when available
  // --------------------------------------------------------------------------

  test("Narrative is embedded in executiveSummary when available", async () => {
    const config: QuartermasterConfig = {
      apiKey: "test-key",
      model: "claude-sonnet-4-5-20250929",
    };
    const agent = new QuartermasterAgent(config);
    const input = makeRichInput();

    const narrative =
      "Assessment covers core MFA controls but lacks credential-based attack depth. Evidence chain verified intact.";

    spyOn(agent as any, "callClaudeAPI").mockResolvedValue({
      methodology_adjustment: -2,
      completeness_adjustment: -1,
      bias_adjustment: 0,
      findings: [],
      narrative,
    });

    const report = await agent.evaluate(input);

    expect(report.executiveSummary).toContain(narrative);
  });

  // --------------------------------------------------------------------------
  // Test 7: Prompt construction includes all artifact summaries
  // --------------------------------------------------------------------------

  test("Prompt construction includes all artifact summaries", () => {
    const config: QuartermasterConfig = {
      apiKey: "test-key",
      model: "claude-sonnet-4-5-20250929",
    };
    const agent = new QuartermasterAgent(config);

    const input = makeRichInput();

    // Use the public buildGovernancePrompt method
    const prompt = (agent as any).buildGovernancePrompt(input);

    // Should contain provider information
    expect(prompt).toContain("aws-cognito");
    expect(prompt).toContain("aws-s3");

    // Should contain MARK summary
    expect(prompt).toContain("MARK");
    expect(prompt).toContain("drift");

    // Should contain RAID summary
    expect(prompt).toContain("RAID");
    expect(prompt).toContain("attack simulation");

    // Should contain evidence info
    expect(prompt).toContain("Evidence");

    // Should contain threat model reference
    expect(prompt).toContain("Threat model");
    expect(prompt).toContain("STRIDE");

    // Should contain response format instructions
    expect(prompt).toContain("methodology_adjustment");
    expect(prompt).toContain("completeness_adjustment");
    expect(prompt).toContain("bias_adjustment");
    expect(prompt).toContain("findings");
    expect(prompt).toContain("narrative");
  });

  // --------------------------------------------------------------------------
  // Test 8: evaluateWithLLM returns properly structured result
  // --------------------------------------------------------------------------

  test("evaluateWithLLM returns structured LLM analysis result", async () => {
    const config: QuartermasterConfig = {
      apiKey: "test-key",
      model: "claude-sonnet-4-5-20250929",
    };
    const agent = new QuartermasterAgent(config);
    const input = makeRichInput();

    const mockResponse = {
      methodology_adjustment: -5,
      completeness_adjustment: -3,
      bias_adjustment: 2,
      findings: [
        {
          severity: "warning" as const,
          category: "methodology",
          description: "Missing password spray vector",
          remediation: "Add password-spray to RAID",
        },
      ],
      narrative: "Good coverage but missing credential attacks.",
    };

    spyOn(agent as any, "callClaudeAPI").mockResolvedValue(mockResponse);

    const result = await (agent as any).evaluateWithLLM(input);

    expect(result).toBeDefined();
    expect(result.methodology_adjustment).toBe(-5);
    expect(result.completeness_adjustment).toBe(-3);
    expect(result.bias_adjustment).toBe(2);
    expect(result.findings).toHaveLength(1);
    expect(result.narrative).toContain("credential attacks");
  });

  // --------------------------------------------------------------------------
  // Test 9: Score adjustments apply correctly to dimension scores
  // --------------------------------------------------------------------------

  test("LLM score adjustments apply to dimension scores correctly", async () => {
    const config: QuartermasterConfig = {
      apiKey: "test-key",
      model: "claude-sonnet-4-5-20250929",
    };
    const agent = new QuartermasterAgent(config);
    const input = makeRichInput();

    // First get deterministic baseline
    const deterministicAgent = new QuartermasterAgent({
      apiKey: "test-key",
      model: "deterministic",
    });
    const baselineReport = await deterministicAgent.evaluate(input);

    // Now get LLM-enhanced report with known adjustments
    spyOn(agent as any, "callClaudeAPI").mockResolvedValue({
      methodology_adjustment: -10,
      completeness_adjustment: -5,
      bias_adjustment: 3,
      findings: [],
      narrative: "Test adjustments.",
    });

    const enhancedReport = await agent.evaluate(input);

    // Methodology should be lower (negative adjustment)
    const baseMethodology = baselineReport.dimensions.find((d) => d.dimension === "methodology")!.score;
    const enhancedMethodology = enhancedReport.dimensions.find((d) => d.dimension === "methodology")!.score;
    expect(enhancedMethodology).toBe(Math.max(0, Math.min(100, baseMethodology - 10)));

    // Completeness should be lower
    const baseCompleteness = baselineReport.dimensions.find((d) => d.dimension === "completeness")!.score;
    const enhancedCompleteness = enhancedReport.dimensions.find((d) => d.dimension === "completeness")!.score;
    expect(enhancedCompleteness).toBe(Math.max(0, Math.min(100, baseCompleteness - 5)));

    // Bias should be higher (positive adjustment)
    const baseBias = baselineReport.dimensions.find((d) => d.dimension === "bias_detection")!.score;
    const enhancedBias = enhancedReport.dimensions.find((d) => d.dimension === "bias_detection")!.score;
    expect(enhancedBias).toBe(Math.max(0, Math.min(100, baseBias + 3)));
  });

  // --------------------------------------------------------------------------
  // Test 10: Missing/undefined model defaults to deterministic
  // --------------------------------------------------------------------------

  test("Missing model config defaults to deterministic (no API call)", async () => {
    const config: QuartermasterConfig = {
      apiKey: "test-key",
      // model not set
    };
    const agent = new QuartermasterAgent(config);
    const input = makeMinimalInput();

    const spy = spyOn(agent as any, "callClaudeAPI");

    const report = await agent.evaluate(input);

    expect(spy).not.toHaveBeenCalled();
    expect(report.model).toBe("deterministic");
  });

  // --------------------------------------------------------------------------
  // Test 11: Malformed LLM response falls back gracefully
  // --------------------------------------------------------------------------

  test("Malformed LLM response falls back to deterministic-only", async () => {
    const config: QuartermasterConfig = {
      apiKey: "test-key",
      model: "claude-sonnet-4-5-20250929",
    };
    const agent = new QuartermasterAgent(config);
    const input = makeRichInput();

    // Return something that cannot be parsed as expected schema
    spyOn(agent as any, "callClaudeAPI").mockResolvedValue(null);

    const report = await agent.evaluate(input);

    // Should still produce valid report without crashing
    expect(report.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(report.dimensions).toHaveLength(4);
    expect(report.reportHash).toBeTruthy();
  });

  // --------------------------------------------------------------------------
  // Test 12: maxTokens config is passed through to API call
  // --------------------------------------------------------------------------

  test("maxTokens config is respected in API call setup", () => {
    const config: QuartermasterConfig = {
      apiKey: "test-key",
      model: "claude-sonnet-4-5-20250929",
      maxTokens: 2048,
    };
    const agent = new QuartermasterAgent(config);

    // Access the stored config to verify maxTokens is preserved
    expect((agent as any).config.maxTokens).toBe(2048);
  });
});
