/**
 * SET Generator Tests
 *
 * Tests Security Event Token generation for FLAGSHIP events.
 * SETs are signed JWTs carrying CAEP event data, using the same
 * Ed25519 keypair as MARQUE signing.
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { decodeJwt, decodeProtectedHeader } from "jose";
import { mkdirSync, rmSync, existsSync } from "fs";
import { MarqueKeyManager } from "../../src/parley/marque-key-manager";
import { generateSET, verifySET, generateFlagshipDescription } from "../../src/flagship/set-generator";
import {
  FLAGSHIP_EVENTS,
  type FlagshipEvent,
  type ColorsChangedData,
  type FleetAlertData,
  type PapersChangedData,
  type MarqueRevokedData,
} from "../../src/flagship/flagship-types";

const TEST_DIR = "/tmp/flagship-set-test";
let keyManager: MarqueKeyManager;

beforeAll(async () => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });

  keyManager = new MarqueKeyManager(`${TEST_DIR}/keys`);
  await keyManager.generateKeypair();
});

describe("SET Generator", () => {
  describe("generateSET", () => {
    test("produces a valid JWT string with 3 parts", async () => {
      const event: FlagshipEvent = {
        type: FLAGSHIP_EVENTS.COLORS_CHANGED,
        data: {
          subject: {
            format: "complex",
            corsair: { marqueId: "marque-001" },
          },
          event_timestamp: 1707300000,
          previous_level: "self-assessed",
          current_level: "ai-verified",
          change_direction: "increase",
        } as ColorsChangedData,
      };

      const jwt = await generateSET(
        event,
        "did:web:grcorsair.com",
        "did:web:partner.example.com",
        keyManager,
      );

      expect(typeof jwt).toBe("string");
      const parts = jwt.split(".");
      expect(parts).toHaveLength(3);
    });

    test("JWT header uses EdDSA algorithm", async () => {
      const event: FlagshipEvent = {
        type: FLAGSHIP_EVENTS.COLORS_CHANGED,
        data: {
          subject: {
            format: "complex",
            corsair: { marqueId: "marque-001" },
          },
          event_timestamp: 1707300000,
          previous_level: "self-assessed",
          current_level: "ai-verified",
          change_direction: "increase",
        } as ColorsChangedData,
      };

      const jwt = await generateSET(
        event,
        "did:web:grcorsair.com",
        "did:web:partner.example.com",
        keyManager,
      );

      const header = decodeProtectedHeader(jwt);
      expect(header.alg).toBe("EdDSA");
    });

    test("JWT header includes typ as secevent+jwt", async () => {
      const event: FlagshipEvent = {
        type: FLAGSHIP_EVENTS.FLEET_ALERT,
        data: {
          subject: {
            format: "complex",
            corsair: { marqueId: "marque-002", provider: "aws-s3" },
          },
          event_timestamp: 1707300000,
          drift_type: "publicAccessBlock",
          severity: "CRITICAL",
          affected_controls: ["AC-3"],
        } as FleetAlertData,
      };

      const jwt = await generateSET(
        event,
        "did:web:grcorsair.com",
        "did:web:partner.example.com",
        keyManager,
      );

      const header = decodeProtectedHeader(jwt);
      expect(header.typ).toBe("secevent+jwt");
    });

    test("JWT payload contains correct iss, aud, and iat", async () => {
      const event: FlagshipEvent = {
        type: FLAGSHIP_EVENTS.COLORS_CHANGED,
        data: {
          subject: {
            format: "complex",
            corsair: { marqueId: "marque-001" },
          },
          event_timestamp: 1707300000,
          previous_level: "self-assessed",
          current_level: "ai-verified",
          change_direction: "increase",
        } as ColorsChangedData,
      };

      const jwt = await generateSET(
        event,
        "did:web:grcorsair.com",
        "did:web:partner.example.com",
        keyManager,
      );

      const payload = decodeJwt(jwt);
      expect(payload.iss).toBe("did:web:grcorsair.com");
      expect(payload.aud).toBe("did:web:partner.example.com");
      expect(typeof payload.iat).toBe("number");
      expect(typeof payload.jti).toBe("string");
      expect((payload.jti as string).length).toBeGreaterThan(0);
    });

    test("JWT payload events field is keyed by event type URI", async () => {
      const event: FlagshipEvent = {
        type: FLAGSHIP_EVENTS.COLORS_CHANGED,
        data: {
          subject: {
            format: "complex",
            corsair: { marqueId: "marque-001" },
          },
          event_timestamp: 1707300000,
          previous_level: "self-assessed",
          current_level: "ai-verified",
          change_direction: "increase",
        } as ColorsChangedData,
      };

      const jwt = await generateSET(
        event,
        "did:web:grcorsair.com",
        "did:web:partner.example.com",
        keyManager,
      );

      const payload = decodeJwt(jwt) as Record<string, unknown>;
      const events = payload.events as Record<string, unknown>;
      expect(events).toBeDefined();
      expect(events[FLAGSHIP_EVENTS.COLORS_CHANGED]).toBeDefined();

      const eventData = events[FLAGSHIP_EVENTS.COLORS_CHANGED] as Record<
        string,
        unknown
      >;
      expect(eventData.subject).toBeDefined();
      expect(eventData.event_timestamp).toBe(1707300000);
    });

    test("generates SET for FLEET_ALERT (compliance-change)", async () => {
      const event: FlagshipEvent = {
        type: FLAGSHIP_EVENTS.FLEET_ALERT,
        data: {
          subject: {
            format: "complex",
            corsair: { marqueId: "marque-002", provider: "aws-s3" },
          },
          event_timestamp: 1707300000,
          drift_type: "publicAccessBlock",
          severity: "CRITICAL",
          affected_controls: ["AC-3", "CC6.1"],
        } as FleetAlertData,
      };

      const jwt = await generateSET(
        event,
        "did:web:grcorsair.com",
        "did:web:receiver.example.com",
        keyManager,
      );

      const payload = decodeJwt(jwt) as Record<string, unknown>;
      const events = payload.events as Record<string, unknown>;
      const alertData = events[FLAGSHIP_EVENTS.FLEET_ALERT] as Record<
        string,
        unknown
      >;
      expect(alertData.drift_type).toBe("publicAccessBlock");
      expect(alertData.severity).toBe("CRITICAL");
    });

    test("generates SET for PAPERS_CHANGED (credential-change)", async () => {
      const event: FlagshipEvent = {
        type: FLAGSHIP_EVENTS.PAPERS_CHANGED,
        data: {
          subject: {
            format: "complex",
            corsair: { marqueId: "marque-003" },
          },
          event_timestamp: 1707300000,
          credential_type: "CorsairCPOE",
          change_type: "issued",
        } as PapersChangedData,
      };

      const jwt = await generateSET(
        event,
        "did:web:grcorsair.com",
        "did:web:auditor.example.com",
        keyManager,
      );

      const payload = decodeJwt(jwt) as Record<string, unknown>;
      const events = payload.events as Record<string, unknown>;
      const papersData = events[FLAGSHIP_EVENTS.PAPERS_CHANGED] as Record<
        string,
        unknown
      >;
      expect(papersData.credential_type).toBe("CorsairCPOE");
      expect(papersData.change_type).toBe("issued");
    });

    test("generates SET for MARQUE_REVOKED (session-revoked)", async () => {
      const event: FlagshipEvent = {
        type: FLAGSHIP_EVENTS.MARQUE_REVOKED,
        data: {
          subject: {
            format: "complex",
            corsair: { marqueId: "marque-004" },
          },
          event_timestamp: 1707300000,
          reason: "Evidence tampering detected",
          revocation_timestamp: 1707300100,
          initiator: "did:web:grcorsair.com",
        } as MarqueRevokedData,
      };

      const jwt = await generateSET(
        event,
        "did:web:grcorsair.com",
        "did:web:fleet.example.com",
        keyManager,
      );

      const payload = decodeJwt(jwt) as Record<string, unknown>;
      const events = payload.events as Record<string, unknown>;
      const revokedData = events[FLAGSHIP_EVENTS.MARQUE_REVOKED] as Record<
        string,
        unknown
      >;
      expect(revokedData.reason).toBe("Evidence tampering detected");
      expect(revokedData.revocation_timestamp).toBe(1707300100);
    });

    test("each SET has a unique jti", async () => {
      const event: FlagshipEvent = {
        type: FLAGSHIP_EVENTS.COLORS_CHANGED,
        data: {
          subject: {
            format: "complex",
            corsair: { marqueId: "marque-001" },
          },
          event_timestamp: 1707300000,
          previous_level: "self-assessed",
          current_level: "ai-verified",
          change_direction: "increase",
        } as ColorsChangedData,
      };

      const jwt1 = await generateSET(
        event,
        "did:web:grcorsair.com",
        "did:web:partner.example.com",
        keyManager,
      );
      const jwt2 = await generateSET(
        event,
        "did:web:grcorsair.com",
        "did:web:partner.example.com",
        keyManager,
      );

      const payload1 = decodeJwt(jwt1);
      const payload2 = decodeJwt(jwt2);
      expect(payload1.jti).not.toBe(payload2.jti);
    });
  });

  describe("verifySET", () => {
    test("verifies a valid SET returns true", async () => {
      const event: FlagshipEvent = {
        type: FLAGSHIP_EVENTS.COLORS_CHANGED,
        data: {
          subject: {
            format: "complex",
            corsair: { marqueId: "marque-001" },
          },
          event_timestamp: 1707300000,
          previous_level: "self-assessed",
          current_level: "ai-verified",
          change_direction: "increase",
        } as ColorsChangedData,
      };

      const jwt = await generateSET(
        event,
        "did:web:grcorsair.com",
        "did:web:partner.example.com",
        keyManager,
      );

      const result = await verifySET(jwt, keyManager);
      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload!.iss).toBe("did:web:grcorsair.com");
    });

    test("rejects a tampered SET", async () => {
      const event: FlagshipEvent = {
        type: FLAGSHIP_EVENTS.COLORS_CHANGED,
        data: {
          subject: {
            format: "complex",
            corsair: { marqueId: "marque-001" },
          },
          event_timestamp: 1707300000,
          previous_level: "self-assessed",
          current_level: "ai-verified",
          change_direction: "increase",
        } as ColorsChangedData,
      };

      const jwt = await generateSET(
        event,
        "did:web:grcorsair.com",
        "did:web:partner.example.com",
        keyManager,
      );

      // Tamper with the payload section
      const parts = jwt.split(".");
      parts[1] = parts[1] + "tampered";
      const tamperedJwt = parts.join(".");

      const result = await verifySET(tamperedJwt, keyManager);
      expect(result.valid).toBe(false);
    });

    test("rejects SET signed with different key (wrong public key)", async () => {
      const otherKeyManager = new MarqueKeyManager(`${TEST_DIR}/other-keys`);
      await otherKeyManager.generateKeypair();

      const event: FlagshipEvent = {
        type: FLAGSHIP_EVENTS.COLORS_CHANGED,
        data: {
          subject: {
            format: "complex",
            corsair: { marqueId: "marque-001" },
          },
          event_timestamp: 1707300000,
          previous_level: "self-assessed",
          current_level: "ai-verified",
          change_direction: "increase",
        } as ColorsChangedData,
      };

      const jwt = await generateSET(
        event,
        "did:web:grcorsair.com",
        "did:web:partner.example.com",
        otherKeyManager,
      );

      // Verify with the original keyManager (different public key)
      const result = await verifySET(jwt, keyManager);
      expect(result.valid).toBe(false);
    });
  });

  // ===========================================================================
  // Phase 2A: Human-readable FLAGSHIP descriptions
  // ===========================================================================

  describe("generateFlagshipDescription", () => {
    test("COLORS_CHANGED upgrade → plain English description", () => {
      const event: FlagshipEvent = {
        type: FLAGSHIP_EVENTS.COLORS_CHANGED,
        data: {
          subject: { format: "complex", corsair: { marqueId: "marque-001" } },
          event_timestamp: 1707300000,
          previous_level: "self-assessed",
          current_level: "ai-verified",
          change_direction: "increase",
        } as ColorsChangedData,
      };
      const desc = generateFlagshipDescription(event);
      expect(desc).toContain("upgraded");
      expect(desc).toContain("self-assessed");
      expect(desc).toContain("ai-verified");
      expect(desc).toContain("marque-001");
    });

    test("COLORS_CHANGED downgrade → mentions weaker evidence", () => {
      const event: FlagshipEvent = {
        type: FLAGSHIP_EVENTS.COLORS_CHANGED,
        data: {
          subject: { format: "complex", corsair: { marqueId: "marque-002" } },
          event_timestamp: 1707300000,
          previous_level: "ai-verified",
          current_level: "self-assessed",
          change_direction: "decrease",
        } as ColorsChangedData,
      };
      const desc = generateFlagshipDescription(event);
      expect(desc).toContain("downgraded");
      expect(desc).toContain("weaker");
    });

    test("FLEET_ALERT → mentions drift type, severity, and affected controls", () => {
      const event: FlagshipEvent = {
        type: FLAGSHIP_EVENTS.FLEET_ALERT,
        data: {
          subject: { format: "complex", corsair: { marqueId: "marque-003", provider: "aws-s3" } },
          event_timestamp: 1707300000,
          drift_type: "publicAccessBlock",
          severity: "CRITICAL",
          affected_controls: ["AC-3", "CC6.1"],
        } as FleetAlertData,
      };
      const desc = generateFlagshipDescription(event);
      expect(desc).toContain("publicAccessBlock");
      expect(desc).toContain("CRITICAL");
      expect(desc).toContain("AC-3, CC6.1");
      expect(desc).toContain("aws-s3");
    });

    test("PAPERS_CHANGED issued → plain English about new CPOE", () => {
      const event: FlagshipEvent = {
        type: FLAGSHIP_EVENTS.PAPERS_CHANGED,
        data: {
          subject: { format: "complex", corsair: { marqueId: "marque-004" } },
          event_timestamp: 1707300000,
          credential_type: "CorsairCPOE",
          change_type: "issued",
        } as PapersChangedData,
      };
      const desc = generateFlagshipDescription(event);
      expect(desc).toContain("new CPOE has been issued");
      expect(desc).toContain("marque-004");
    });

    test("PAPERS_CHANGED revoked → warning about trust", () => {
      const event: FlagshipEvent = {
        type: FLAGSHIP_EVENTS.PAPERS_CHANGED,
        data: {
          subject: { format: "complex", corsair: { marqueId: "marque-005" } },
          event_timestamp: 1707300000,
          credential_type: "CorsairCPOE",
          change_type: "revoked",
        } as PapersChangedData,
      };
      const desc = generateFlagshipDescription(event);
      expect(desc).toContain("revoked");
      expect(desc).toContain("should no longer be trusted");
    });

    test("PAPERS_CHANGED expired → renewal prompt", () => {
      const event: FlagshipEvent = {
        type: FLAGSHIP_EVENTS.PAPERS_CHANGED,
        data: {
          subject: { format: "complex", corsair: { marqueId: "marque-006" } },
          event_timestamp: 1707300000,
          credential_type: "CorsairCPOE",
          change_type: "expired",
        } as PapersChangedData,
      };
      const desc = generateFlagshipDescription(event);
      expect(desc).toContain("expired");
      expect(desc).toContain("renewed");
    });

    test("MARQUE_REVOKED → emergency notice with reason", () => {
      const event: FlagshipEvent = {
        type: FLAGSHIP_EVENTS.MARQUE_REVOKED,
        data: {
          subject: { format: "complex", corsair: { marqueId: "marque-007" } },
          event_timestamp: 1707300000,
          reason: "Evidence tampering detected",
          revocation_timestamp: 1707300100,
          initiator: "did:web:grcorsair.com",
        } as MarqueRevokedData,
      };
      const desc = generateFlagshipDescription(event);
      expect(desc).toContain("EMERGENCY");
      expect(desc).toContain("Evidence tampering detected");
      expect(desc).toContain("did:web:grcorsair.com");
      expect(desc).toContain("should no longer be accepted");
    });

    test("includes provider when present in subject", () => {
      const event: FlagshipEvent = {
        type: FLAGSHIP_EVENTS.FLEET_ALERT,
        data: {
          subject: { format: "complex", corsair: { marqueId: "marque-008", provider: "aws-cognito" } },
          event_timestamp: 1707300000,
          drift_type: "mfaDisabled",
          severity: "HIGH",
          affected_controls: ["AC-2"],
        } as FleetAlertData,
      };
      const desc = generateFlagshipDescription(event);
      expect(desc).toContain("aws-cognito");
    });
  });
});
