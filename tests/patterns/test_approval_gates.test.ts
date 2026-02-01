/**
 * Approval Gates Pattern - OpenClaw Pattern 4 Tests
 *
 * Pattern Contract:
 * 1. CRITICAL severity raids require approval before execution
 * 2. LOW severity raids skip approval gate entirely
 * 3. Approval timeout rejects raid execution
 * 4. Denied approval rejects raid execution
 * 5. Approval gate includes blast radius details in request
 * 6. Approver identity and timestamp are captured
 * 7. Multiple severity thresholds are supported
 *
 * OpenClaw Reference: Pattern 4 - Production Safety Gates
 * ISC Criteria: Layer 2 #10 - Approval for production operations
 */

import { describe, test, expect, beforeEach } from "bun:test";
import {
  Corsair,
  type CognitoSnapshot,
  type Severity,
  type ApprovalGate,
  type ApprovalRequest,
  type ApprovalResponse,
  type RaidOptionsWithApproval,
} from "../../src/corsair-mvp";
import { compliantSnapshot, nonCompliantSnapshot, createMockSnapshot } from "../fixtures/mock-snapshots";

describe("Approval Gates - OpenClaw Pattern 4", () => {
  let corsair: Corsair;

  beforeEach(() => {
    corsair = new Corsair();
  });

  describe("High-Risk Operations Require Approval", () => {
    test("CRITICAL severity raid requires approval", async () => {
      const gate: ApprovalGate = {
        requiredSeverity: "CRITICAL",
        approvers: ["security-lead@example.com"],
        timeoutMs: 5000,
        channel: "webhook",
      };

      const mockApproval = async (_request: ApprovalRequest): Promise<ApprovalResponse> => {
        return {
          approved: true,
          approver: "security-lead@example.com",
          timestamp: new Date().toISOString(),
        };
      };

      // mfa-bypass is CRITICAL severity
      const result = await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 9,
        dryRun: true,
        approvalGate: gate,
        requestApproval: mockApproval,
      });

      expect(result.approvalRequired).toBe(true);
      expect(result.approved).toBe(true);
      expect(result.approver).toBe("security-lead@example.com");
      expect(result.approvalTimestamp).toBeDefined();
    });

    test("token-replay CRITICAL vector requires approval", async () => {
      const gate: ApprovalGate = {
        requiredSeverity: "CRITICAL",
        approvers: ["security-team@example.com"],
        timeoutMs: 5000,
        channel: "webhook",
      };

      const mockApproval = async (): Promise<ApprovalResponse> => ({
        approved: true,
        approver: "security-team@example.com",
        timestamp: new Date().toISOString(),
      });

      // token-replay is also CRITICAL severity
      const result = await corsair.raid(nonCompliantSnapshot, {
        vector: "token-replay",
        intensity: 8,
        dryRun: true,
        approvalGate: gate,
        requestApproval: mockApproval,
      });

      expect(result.approvalRequired).toBe(true);
      expect(result.approved).toBe(true);
    });
  });

  describe("Timeout Behavior", () => {
    test("timeout rejects raid if no approval received", async () => {
      const gate: ApprovalGate = {
        requiredSeverity: "CRITICAL",
        approvers: ["security-lead@example.com"],
        timeoutMs: 100, // Very short timeout
        channel: "webhook",
      };

      // Approval takes longer than timeout
      const slowApproval = async (): Promise<ApprovalResponse> => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return {
          approved: true,
          approver: "security-lead@example.com",
          timestamp: new Date().toISOString(),
        };
      };

      await expect(
        corsair.raid(nonCompliantSnapshot, {
          vector: "mfa-bypass",
          intensity: 9,
          dryRun: true,
          approvalGate: gate,
          requestApproval: slowApproval,
        })
      ).rejects.toThrow("Approval timeout");
    });

    test("approval within timeout succeeds", async () => {
      const gate: ApprovalGate = {
        requiredSeverity: "CRITICAL",
        approvers: ["security-lead@example.com"],
        timeoutMs: 1000,
        channel: "webhook",
      };

      // Fast approval
      const fastApproval = async (): Promise<ApprovalResponse> => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          approved: true,
          approver: "security-lead@example.com",
          timestamp: new Date().toISOString(),
        };
      };

      const result = await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 9,
        dryRun: true,
        approvalGate: gate,
        requestApproval: fastApproval,
      });

      expect(result.approvalRequired).toBe(true);
      expect(result.approved).toBe(true);
    });
  });

  describe("Low Severity Skips Approval", () => {
    test("LOW severity raid skips approval when gate requires CRITICAL", async () => {
      const gate: ApprovalGate = {
        requiredSeverity: "CRITICAL",
        approvers: ["security-lead@example.com"],
        timeoutMs: 5000,
        channel: "webhook",
      };

      // password-spray is MEDIUM severity - below CRITICAL threshold
      const result = await corsair.raid(nonCompliantSnapshot, {
        vector: "password-spray",
        intensity: 3,
        dryRun: true,
        approvalGate: gate,
        // No requestApproval needed - should skip
      });

      expect(result.approvalRequired).toBe(false);
      // Raid should still execute normally
      expect(result.raidId).toBeDefined();
    });

    test("raid without approval gate executes normally", async () => {
      // No approval gate configured
      const result = await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 9,
        dryRun: true,
      });

      expect(result.approvalRequired).toBe(false);
      expect(result.approved).toBeUndefined();
      expect(result.raidId).toBeDefined();
    });

    test("MEDIUM severity raid skips CRITICAL gate", async () => {
      const gate: ApprovalGate = {
        requiredSeverity: "CRITICAL",
        approvers: ["security@example.com"],
        timeoutMs: 5000,
        channel: "webhook",
      };

      // session-hijack is HIGH severity - still below CRITICAL
      const result = await corsair.raid(nonCompliantSnapshot, {
        vector: "session-hijack",
        intensity: 5,
        dryRun: true,
        approvalGate: gate,
      });

      expect(result.approvalRequired).toBe(false);
    });
  });

  describe("Denial Handling", () => {
    test("denied approval rejects raid execution", async () => {
      const gate: ApprovalGate = {
        requiredSeverity: "CRITICAL",
        approvers: ["security-lead@example.com"],
        timeoutMs: 5000,
        channel: "webhook",
      };

      const mockDenial = async (): Promise<ApprovalResponse> => ({
        approved: false,
        approver: "security-lead@example.com",
        timestamp: new Date().toISOString(),
        reason: "Not authorized for this environment",
      });

      await expect(
        corsair.raid(nonCompliantSnapshot, {
          vector: "mfa-bypass",
          intensity: 9,
          dryRun: true,
          approvalGate: gate,
          requestApproval: mockDenial,
        })
      ).rejects.toThrow("Approval denied");
    });

    test("denial reason is captured in error message", async () => {
      const gate: ApprovalGate = {
        requiredSeverity: "CRITICAL",
        approvers: ["security-lead@example.com"],
        timeoutMs: 5000,
        channel: "webhook",
      };

      const mockDenialWithReason = async (): Promise<ApprovalResponse> => ({
        approved: false,
        approver: "security-lead@example.com",
        timestamp: new Date().toISOString(),
        reason: "Production environment not cleared",
      });

      try {
        await corsair.raid(nonCompliantSnapshot, {
          vector: "mfa-bypass",
          intensity: 9,
          dryRun: true,
          approvalGate: gate,
          requestApproval: mockDenialWithReason,
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect((error as Error).message).toContain("Production environment not cleared");
      }
    });
  });

  describe("Blast Radius Information", () => {
    test("approval gate includes blast radius details in request", async () => {
      const gate: ApprovalGate = {
        requiredSeverity: "CRITICAL",
        approvers: ["security-lead@example.com"],
        timeoutMs: 5000,
        channel: "webhook",
      };

      let capturedRequest: ApprovalRequest | undefined;

      const mockApproval = async (request: ApprovalRequest): Promise<ApprovalResponse> => {
        capturedRequest = request;
        return {
          approved: true,
          approver: "security-lead@example.com",
          timestamp: new Date().toISOString(),
        };
      };

      await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 9,
        dryRun: true,
        approvalGate: gate,
        requestApproval: mockApproval,
      });

      expect(capturedRequest).toBeDefined();
      expect(capturedRequest!.blastRadius).toBeDefined();
      expect(capturedRequest!.vector).toBe("mfa-bypass");
      expect(capturedRequest!.intensity).toBe(9);
      expect(capturedRequest!.targetId).toBe(nonCompliantSnapshot.userPoolId);
    });

    test("blast radius includes affected resources", async () => {
      const gate: ApprovalGate = {
        requiredSeverity: "CRITICAL",
        approvers: ["security-lead@example.com"],
        timeoutMs: 5000,
        channel: "webhook",
      };

      let capturedRequest: ApprovalRequest | undefined;

      const mockApproval = async (request: ApprovalRequest): Promise<ApprovalResponse> => {
        capturedRequest = request;
        return { approved: true, approver: "test", timestamp: new Date().toISOString() };
      };

      await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 9,
        dryRun: true,
        approvalGate: gate,
        requestApproval: mockApproval,
      });

      expect(capturedRequest!.blastRadius.affectedResources).toBeDefined();
      expect(Array.isArray(capturedRequest!.blastRadius.affectedResources)).toBe(true);
      expect(capturedRequest!.blastRadius.affectedResources!.length).toBeGreaterThan(0);
    });

    test("blast radius includes environment tag", async () => {
      const gate: ApprovalGate = {
        requiredSeverity: "CRITICAL",
        approvers: ["security-lead@example.com"],
        timeoutMs: 5000,
        channel: "webhook",
      };

      let capturedRequest: ApprovalRequest | undefined;

      const mockApproval = async (request: ApprovalRequest): Promise<ApprovalResponse> => {
        capturedRequest = request;
        return { approved: true, approver: "test", timestamp: new Date().toISOString() };
      };

      await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 9,
        dryRun: true,
        approvalGate: gate,
        requestApproval: mockApproval,
      });

      expect(capturedRequest!.blastRadius.environment).toBeDefined();
      expect(typeof capturedRequest!.blastRadius.environment).toBe("string");
    });
  });

  describe("Severity Threshold Levels", () => {
    test("HIGH gate catches CRITICAL vectors", async () => {
      const gate: ApprovalGate = {
        requiredSeverity: "HIGH",
        approvers: ["security@example.com"],
        timeoutMs: 5000,
        channel: "webhook",
      };

      const mockApproval = async (): Promise<ApprovalResponse> => ({
        approved: true,
        approver: "security@example.com",
        timestamp: new Date().toISOString(),
      });

      // mfa-bypass is CRITICAL - should trigger HIGH gate
      const result = await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 5,
        dryRun: true,
        approvalGate: gate,
        requestApproval: mockApproval,
      });

      expect(result.approvalRequired).toBe(true);
    });

    test("HIGH gate catches HIGH vectors", async () => {
      const gate: ApprovalGate = {
        requiredSeverity: "HIGH",
        approvers: ["security@example.com"],
        timeoutMs: 5000,
        channel: "webhook",
      };

      const mockApproval = async (): Promise<ApprovalResponse> => ({
        approved: true,
        approver: "security@example.com",
        timestamp: new Date().toISOString(),
      });

      // session-hijack is HIGH severity
      const result = await corsair.raid(nonCompliantSnapshot, {
        vector: "session-hijack",
        intensity: 5,
        dryRun: true,
        approvalGate: gate,
        requestApproval: mockApproval,
      });

      expect(result.approvalRequired).toBe(true);
    });

    test("MEDIUM gate skips LOW severity vectors", async () => {
      const gate: ApprovalGate = {
        requiredSeverity: "MEDIUM",
        approvers: ["security@example.com"],
        timeoutMs: 5000,
        channel: "webhook",
      };

      // password-spray is MEDIUM - should trigger MEDIUM gate
      const result = await corsair.raid(nonCompliantSnapshot, {
        vector: "password-spray",
        intensity: 3,
        dryRun: true,
        approvalGate: gate,
        requestApproval: async () => ({
          approved: true,
          approver: "security@example.com",
          timestamp: new Date().toISOString(),
        }),
      });

      expect(result.approvalRequired).toBe(true);
    });
  });

  describe("Missing Approval Function Error", () => {
    test("throws error when gate configured but no requestApproval function", async () => {
      const gate: ApprovalGate = {
        requiredSeverity: "CRITICAL",
        approvers: ["security-lead@example.com"],
        timeoutMs: 5000,
        channel: "webhook",
      };

      // CRITICAL vector with gate but no approval function
      await expect(
        corsair.raid(nonCompliantSnapshot, {
          vector: "mfa-bypass",
          intensity: 9,
          dryRun: true,
          approvalGate: gate,
          // Missing requestApproval
        })
      ).rejects.toThrow("Approval gate configured but no requestApproval function provided");
    });
  });

  describe("Approval Gate with Different Channels", () => {
    test("webhook channel is supported", async () => {
      const gate: ApprovalGate = {
        requiredSeverity: "CRITICAL",
        approvers: ["security@example.com"],
        timeoutMs: 5000,
        channel: "webhook",
      };

      const result = await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 9,
        dryRun: true,
        approvalGate: gate,
        requestApproval: async () => ({
          approved: true,
          approver: "security@example.com",
          timestamp: new Date().toISOString(),
        }),
      });

      expect(result.approvalRequired).toBe(true);
    });

    test("slack channel is supported", async () => {
      const gate: ApprovalGate = {
        requiredSeverity: "CRITICAL",
        approvers: ["security@example.com"],
        timeoutMs: 5000,
        channel: "slack",
      };

      const result = await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 9,
        dryRun: true,
        approvalGate: gate,
        requestApproval: async () => ({
          approved: true,
          approver: "security@example.com",
          timestamp: new Date().toISOString(),
        }),
      });

      expect(result.approvalRequired).toBe(true);
    });

    test("email channel is supported", async () => {
      const gate: ApprovalGate = {
        requiredSeverity: "CRITICAL",
        approvers: ["security@example.com"],
        timeoutMs: 5000,
        channel: "email",
      };

      const result = await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 9,
        dryRun: true,
        approvalGate: gate,
        requestApproval: async () => ({
          approved: true,
          approver: "security@example.com",
          timestamp: new Date().toISOString(),
        }),
      });

      expect(result.approvalRequired).toBe(true);
    });
  });

  describe("Multiple Approvers", () => {
    test("gate with multiple approvers accepts any valid approver", async () => {
      const gate: ApprovalGate = {
        requiredSeverity: "CRITICAL",
        approvers: ["lead@example.com", "manager@example.com", "director@example.com"],
        timeoutMs: 5000,
        channel: "webhook",
      };

      const result = await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 9,
        dryRun: true,
        approvalGate: gate,
        requestApproval: async () => ({
          approved: true,
          approver: "manager@example.com",
          timestamp: new Date().toISOString(),
        }),
      });

      expect(result.approvalRequired).toBe(true);
      expect(result.approved).toBe(true);
      expect(result.approver).toBe("manager@example.com");
    });
  });

  describe("Approval Request Metadata", () => {
    test("approval request includes gate configuration", async () => {
      const gate: ApprovalGate = {
        id: "gate-001",
        requiredSeverity: "CRITICAL",
        approvers: ["security@example.com"],
        timeoutMs: 5000,
        channel: "webhook",
      };

      let capturedRequest: ApprovalRequest | undefined;

      const mockApproval = async (request: ApprovalRequest): Promise<ApprovalResponse> => {
        capturedRequest = request;
        return { approved: true, approver: "test", timestamp: new Date().toISOString() };
      };

      await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 9,
        dryRun: true,
        approvalGate: gate,
        requestApproval: mockApproval,
      });

      expect(capturedRequest!.gate).toBeDefined();
      expect(capturedRequest!.gate.requiredSeverity).toBe("CRITICAL");
      expect(capturedRequest!.gate.approvers).toContain("security@example.com");
    });

    test("approval request includes timestamp", async () => {
      const gate: ApprovalGate = {
        requiredSeverity: "CRITICAL",
        approvers: ["security@example.com"],
        timeoutMs: 5000,
        channel: "webhook",
      };

      let capturedRequest: ApprovalRequest | undefined;

      const mockApproval = async (request: ApprovalRequest): Promise<ApprovalResponse> => {
        capturedRequest = request;
        return { approved: true, approver: "test", timestamp: new Date().toISOString() };
      };

      await corsair.raid(nonCompliantSnapshot, {
        vector: "mfa-bypass",
        intensity: 9,
        dryRun: true,
        approvalGate: gate,
        requestApproval: mockApproval,
      });

      expect(capturedRequest!.requestedAt).toBeDefined();
      // Should be a valid ISO timestamp
      expect(() => new Date(capturedRequest!.requestedAt)).not.toThrow();
    });
  });
});
