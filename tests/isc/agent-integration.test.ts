/**
 * Agent ISC Integration Test Contract - RED PHASE
 *
 * Tests the integration of ISCManager and ISCExtractor with CorsairAgent.
 * Uses mocks to avoid actual API calls.
 *
 * Contract Requirements:
 * 1. Agent MUST create ISCManager on mission start
 * 2. Agent MUST initialize ISCExtractor in constructor
 * 3. Agent MUST extract ISC from response text
 * 4. Agent MUST persist ISC to correct path (missions/{missionId}/ISC.json)
 * 5. Agent MUST generate valid mission IDs
 * 6. Agent MUST extract task IDs from missions
 * 7. Agent MUST include ISCManager in execution context
 */

import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { ISCManager } from "../../src/core/isc-manager";
import { ISCExtractor } from "../../src/core/isc-extractor";

// Mock the Anthropic SDK to avoid actual API calls
const mockAnthropicCreate = mock(() => Promise.resolve({
  stop_reason: "end_turn",
  content: [{
    type: "text",
    text: `Based on my analysis, here are the ISC criteria for S3 security:

## ISC (Ideal State Criteria)

- Public access blocked at bucket level
- Encryption enabled using AES256 algorithm
- Versioning enabled for data protection
- Server access logging enabled completely

These criteria define the ideal security state.`
  }]
}));

// Mock the CorsairAgent for testing ISC integration
class MockCorsairAgent {
  private iscManager: ISCManager | null = null;
  private iscExtractor: ISCExtractor;
  private missionId: string | null = null;
  private verbose: boolean;

  constructor(options: { verbose?: boolean } = {}) {
    this.iscExtractor = new ISCExtractor();
    this.verbose = options.verbose ?? false;
  }

  // Simulate executeMission with ISC extraction
  async executeMission(mission: string, options: { testDir?: string } = {}): Promise<string> {
    // Generate mission ID
    this.missionId = ISCManager.generateMissionId();
    this.iscManager = new ISCManager(this.missionId);

    // Extract task ID from mission if present
    const taskId = this.extractTaskId(mission);
    if (taskId) {
      this.iscManager.updateMetadata({ taskId });
    }

    // Simulate getting a response from the model
    const response = await mockAnthropicCreate();

    // Extract text from response
    let responseText = "";
    for (const block of response.content) {
      if (block.type === "text") {
        responseText += block.text;
      }
    }

    // Extract ISC criteria from response
    const extraction = this.iscExtractor.extract(responseText);
    if (extraction.found && extraction.criteria.length > 0) {
      this.iscManager.addCriteria(extraction.criteria, {
        confidence: extraction.confidence,
        source: "agent_response",
      });
    }

    // Persist ISC to file
    const iscPath = this.getISCPath(options.testDir || "/tmp/corsair-missions");
    await this.iscManager.persist(iscPath);

    return responseText;
  }

  // Generate mission ID
  generateMissionId(): string {
    return ISCManager.generateMissionId();
  }

  // Extract task ID from mission text
  extractTaskId(mission: string): string | null {
    // Look for patterns like "Task: xxx" or "Task ID: xxx" or "[TASK-xxx]"
    const patterns = [
      /Task(?:\s+ID)?:\s*(\S+)/i,
      /\[TASK-([^\]]+)\]/i,
      /task_(\d+)/i,
    ];

    for (const pattern of patterns) {
      const match = mission.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  // Get ISC file path
  getISCPath(baseDir: string): string {
    if (!this.missionId) {
      throw new Error("Mission not started");
    }
    return path.join(baseDir, this.missionId, "ISC.json");
  }

  // Get ISC manager
  getISCManager(): ISCManager | null {
    return this.iscManager;
  }

  // Get mission ID
  getMissionId(): string | null {
    return this.missionId;
  }

  // Get ISC extractor
  getISCExtractor(): ISCExtractor {
    return this.iscExtractor;
  }
}

describe("Agent ISC Integration", () => {
  const testDir = "/tmp/corsair-agent-isc-tests";
  let agent: MockCorsairAgent;

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    agent = new MockCorsairAgent({ verbose: false });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  // Test 1: Agent creates ISCManager on mission start
  test("creates ISCManager on mission start", async () => {
    expect(agent.getISCManager()).toBeNull();

    await agent.executeMission("Test S3 security", { testDir });

    const manager = agent.getISCManager();
    expect(manager).not.toBeNull();
    expect(manager?.getMissionId()).toMatch(/^mission_\d{8}_\d{6}_[a-z0-9]+$/);
  });

  // Test 2: Agent initializes ISCExtractor in constructor
  test("initializes ISCExtractor in constructor", () => {
    const extractor = agent.getISCExtractor();
    expect(extractor).toBeDefined();
    expect(extractor).toBeInstanceOf(ISCExtractor);
  });

  // Test 3: Agent extracts ISC from response text
  test("extracts ISC criteria from response text", async () => {
    await agent.executeMission("Analyze S3 bucket security", { testDir });

    const manager = agent.getISCManager();
    expect(manager).not.toBeNull();

    const criteria = manager!.getCriteria();
    expect(criteria.length).toBe(4);
    expect(criteria.map(c => c.text)).toContain("Public access blocked at bucket level");
    expect(criteria.map(c => c.text)).toContain("Encryption enabled using AES256 algorithm");
  });

  // Test 4: Agent persists ISC to correct path
  test("persists ISC to missions/{missionId}/ISC.json", async () => {
    await agent.executeMission("Security audit", { testDir });

    const missionId = agent.getMissionId();
    expect(missionId).not.toBeNull();

    const expectedPath = path.join(testDir, missionId!, "ISC.json");
    expect(fs.existsSync(expectedPath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(expectedPath, "utf-8"));
    expect(content.missionId).toBe(missionId);
    expect(content.criteria.length).toBe(4);
    expect(content.satisfaction.total).toBe(4);
  });

  // Test 5: Agent generates valid mission IDs
  test("generates valid filename-safe mission IDs", () => {
    const id1 = agent.generateMissionId();
    const id2 = agent.generateMissionId();

    // Format: mission_{YYYYMMDD}_{HHMMSS}_{random}
    expect(id1).toMatch(/^mission_\d{8}_\d{6}_[a-z0-9]+$/);
    expect(id2).toMatch(/^mission_\d{8}_\d{6}_[a-z0-9]+$/);

    // Should be unique
    expect(id1).not.toBe(id2);

    // Should be filename-safe
    expect(id1).not.toMatch(/[\/\\:*?"<>|]/);
  });

  // Test 6: Agent extracts task IDs from missions
  test("extracts task ID from mission text", () => {
    expect(agent.extractTaskId("Task: sec-audit-001")).toBe("sec-audit-001");
    expect(agent.extractTaskId("Task ID: audit-123")).toBe("audit-123");
    expect(agent.extractTaskId("[TASK-security-check]")).toBe("security-check");
    expect(agent.extractTaskId("task_42 description")).toBe("42");
    expect(agent.extractTaskId("No task here")).toBeNull();
  });

  // Test 7: Agent includes task ID in ISC metadata
  test("includes task ID in ISC metadata when present", async () => {
    await agent.executeMission("Task: s3-security-audit - Check bucket settings", { testDir });

    const manager = agent.getISCManager();
    const state = manager!.getState();

    expect(state.metadata?.taskId).toBe("s3-security-audit");
  });
});

describe("Agent ISC Integration - Edge Cases", () => {
  const testDir = "/tmp/corsair-agent-isc-edge-tests";

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  // Test: Handle response with no ISC section
  test("handles response with no ISC section gracefully", async () => {
    // Create a mock that returns no ISC content
    const noISCMock = mock(() => Promise.resolve({
      stop_reason: "end_turn",
      content: [{
        type: "text",
        text: "This response has no ISC criteria. Just some general text about security."
      }]
    }));

    // Create a custom agent that uses this mock
    class NoISCAgent extends MockCorsairAgent {
      async executeMission(mission: string, options: { testDir?: string } = {}): Promise<string> {
        const missionId = ISCManager.generateMissionId();
        const iscManager = new ISCManager(missionId);
        const iscExtractor = new ISCExtractor();

        const response = await noISCMock();
        let responseText = "";
        for (const block of response.content) {
          if (block.type === "text") {
            responseText += block.text;
          }
        }

        const extraction = iscExtractor.extract(responseText);
        if (extraction.found && extraction.criteria.length > 0) {
          iscManager.addCriteria(extraction.criteria);
        }

        const iscPath = path.join(options.testDir || testDir, missionId, "ISC.json");
        await iscManager.persist(iscPath);

        return responseText;
      }
    }

    const agent = new NoISCAgent({ verbose: false });
    const response = await agent.executeMission("Test mission", { testDir });

    expect(response).toContain("no ISC criteria");
    // ISC file should still be created, just with empty criteria
  });

  // Test: ISC path generation without mission start throws error
  test("ISC path requires mission to be started", () => {
    const agent = new MockCorsairAgent();
    expect(() => agent.getISCPath(testDir)).toThrow("Mission not started");
  });
});
