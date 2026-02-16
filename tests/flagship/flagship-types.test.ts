/**
 * FLAGSHIP Types Tests
 *
 * Validates the type definitions for SSF/SET/CAEP event system.
 * FLAGSHIP = the command ship that signals fleet-wide status changes.
 */

import { describe, test, expect } from "bun:test";
import {
  FLAGSHIP_EVENTS,
  type FlagshipEventType,
  type FlagshipSubject,
  type CAEPEventData,
  type FleetAlertData,
  type PapersChangedData,
  type MarqueRevokedData,
  type FlagshipEvent,
  type SETPayload,
  type SSFStreamConfig,
  type SSFStream,
  type FlagshipConfig,
} from "../../src/flagship/flagship-types";

describe("FLAGSHIP Types", () => {
  describe("FLAGSHIP_EVENTS constants", () => {
    test("FLEET_ALERT maps to compliance-change event URI", () => {
      expect(FLAGSHIP_EVENTS.FLEET_ALERT).toBe(
        "https://grcorsair.com/events/compliance-change/v1",
      );
    });

    test("PAPERS_CHANGED maps to credential-change event URI", () => {
      expect(FLAGSHIP_EVENTS.PAPERS_CHANGED).toBe(
        "https://grcorsair.com/events/credential-change/v1",
      );
    });

    test("MARQUE_REVOKED maps to session-revoked event URI", () => {
      expect(FLAGSHIP_EVENTS.MARQUE_REVOKED).toBe(
        "https://grcorsair.com/events/session-revoked/v1",
      );
    });

    test("all event types are defined", () => {
      const keys = Object.keys(FLAGSHIP_EVENTS);
      expect(keys).toHaveLength(4);
      expect(keys).toContain("COLORS_CHANGED");
      expect(keys).toContain("FLEET_ALERT");
      expect(keys).toContain("PAPERS_CHANGED");
      expect(keys).toContain("MARQUE_REVOKED");
    });
  });

  describe("FlagshipSubject", () => {
    test("subject uses complex format with corsair namespace", () => {
      const subject: FlagshipSubject = {
        format: "complex",
        corsair: {
          marqueId: "marque-001",
          provider: "aws-cognito",
          criterion: "mfa-enabled",
        },
      };

      expect(subject.format).toBe("complex");
      expect(subject.corsair.marqueId).toBe("marque-001");
      expect(subject.corsair.provider).toBe("aws-cognito");
      expect(subject.corsair.criterion).toBe("mfa-enabled");
    });

    test("subject works with only required marqueId", () => {
      const subject: FlagshipSubject = {
        format: "complex",
        corsair: {
          marqueId: "marque-002",
        },
      };

      expect(subject.corsair.marqueId).toBe("marque-002");
      expect(subject.corsair.provider).toBeUndefined();
      expect(subject.corsair.criterion).toBeUndefined();
    });
  });

  describe("FleetAlertData (compliance-change)", () => {
    test("carries drift detection data with severity", () => {
      const data: FleetAlertData = {
        subject: {
          format: "complex",
          corsair: { marqueId: "marque-001", provider: "aws-s3" },
        },
        event_timestamp: 1707300000,
        drift_type: "publicAccessBlock",
        severity: "CRITICAL",
        affected_controls: ["AC-3", "CC6.1"],
      };

      expect(data.drift_type).toBe("publicAccessBlock");
      expect(data.severity).toBe("CRITICAL");
      expect(data.affected_controls).toHaveLength(2);
    });
  });

  describe("PapersChangedData (credential-change)", () => {
    test("carries CPOE lifecycle event", () => {
      const data: PapersChangedData = {
        subject: {
          format: "complex",
          corsair: { marqueId: "marque-001" },
        },
        event_timestamp: 1707300000,
        credential_type: "CorsairCPOE",
        change_type: "issued",
      };

      expect(data.credential_type).toBe("CorsairCPOE");
      expect(data.change_type).toBe("issued");
    });

    test("supports all change types", () => {
      const changeTypes: PapersChangedData["change_type"][] = [
        "issued",
        "renewed",
        "revoked",
        "expired",
      ];
      expect(changeTypes).toHaveLength(4);
    });
  });

  describe("MarqueRevokedData (session-revoked)", () => {
    test("carries emergency revocation data", () => {
      const data: MarqueRevokedData = {
        subject: {
          format: "complex",
          corsair: { marqueId: "marque-001" },
        },
        event_timestamp: 1707300000,
        reason: "Evidence tampering detected",
        revocation_timestamp: 1707300100,
        initiator: "did:web:grcorsair.com",
      };

      expect(data.reason).toBe("Evidence tampering detected");
      expect(data.revocation_timestamp).toBeGreaterThan(data.event_timestamp);
      expect(data.initiator).toBe("did:web:grcorsair.com");
    });
  });

  describe("FlagshipEvent", () => {
    test("wraps event type and data together", () => {
      const event: FlagshipEvent = {
        type: FLAGSHIP_EVENTS.FLEET_ALERT,
        data: {
          subject: {
            format: "complex",
            corsair: { marqueId: "marque-001" },
          },
          event_timestamp: 1707300000,
          drift_type: "config-drift",
          severity: "HIGH",
          affected_controls: ["CC6.1"],
        } as FleetAlertData,
      };

      expect(event.type).toBe(FLAGSHIP_EVENTS.FLEET_ALERT);
      expect(event.data.event_timestamp).toBe(1707300000);
    });
  });

  describe("SETPayload", () => {
    test("follows SET JWT structure with events keyed by URI", () => {
      const payload: SETPayload = {
        iss: "did:web:grcorsair.com",
        iat: 1707300000,
        jti: "set-unique-id",
        aud: "did:web:partner.example.com",
        events: {
          [FLAGSHIP_EVENTS.PAPERS_CHANGED]: {
            subject: {
              format: "complex",
              corsair: { marqueId: "marque-001" },
            },
            event_timestamp: 1707300000,
            credential_type: "CorsairCPOE",
            change_type: "issued",
          } as PapersChangedData,
        },
      };

      expect(payload.iss).toBe("did:web:grcorsair.com");
      expect(payload.events[FLAGSHIP_EVENTS.PAPERS_CHANGED]).toBeDefined();
    });
  });

  describe("SSFStreamConfig", () => {
    test("configures push delivery with endpoint URL", () => {
      const config: SSFStreamConfig = {
        delivery: {
          method: "push",
          endpoint_url: "https://receiver.example.com/events",
        },
        events_requested: [
          FLAGSHIP_EVENTS.FLEET_ALERT,
        ],
        format: "jwt",
      };

      expect(config.delivery.method).toBe("push");
      expect(config.delivery.endpoint_url).toBe(
        "https://receiver.example.com/events",
      );
      expect(config.events_requested).toHaveLength(1);
      expect(config.format).toBe("jwt");
    });

    test("configures poll delivery without endpoint URL", () => {
      const config: SSFStreamConfig = {
        delivery: { method: "poll" },
        events_requested: [FLAGSHIP_EVENTS.PAPERS_CHANGED],
        format: "jwt",
      };

      expect(config.delivery.method).toBe("poll");
      expect(config.delivery.endpoint_url).toBeUndefined();
    });
  });

  describe("SSFStream", () => {
    test("represents a configured SSF stream with lifecycle", () => {
      const stream: SSFStream = {
        streamId: "stream-001",
        status: "active",
        config: {
          delivery: { method: "push", endpoint_url: "https://example.com" },
          events_requested: [FLAGSHIP_EVENTS.FLEET_ALERT],
          format: "jwt",
        },
        createdAt: "2026-02-07T00:00:00Z",
        updatedAt: "2026-02-07T00:00:00Z",
      };

      expect(stream.streamId).toBe("stream-001");
      expect(stream.status).toBe("active");
      expect(stream.config.events_requested).toHaveLength(1);
    });

    test("supports paused and deleted statuses", () => {
      const statuses: SSFStream["status"][] = ["active", "paused", "deleted"];
      expect(statuses).toHaveLength(3);
    });
  });

  describe("FlagshipConfig", () => {
    test("configures flagship for Parley integration", () => {
      const config: FlagshipConfig = {
        enabled: true,
        issuerDID: "did:web:grcorsair.com",
        defaultAudience: "did:web:partner.example.com",
      };

      expect(config.enabled).toBe(true);
      expect(config.issuerDID).toBe("did:web:grcorsair.com");
      expect(config.defaultAudience).toBe("did:web:partner.example.com");
    });

    test("works with only required fields", () => {
      const config: FlagshipConfig = {
        enabled: false,
        issuerDID: "did:web:grcorsair.com",
      };

      expect(config.enabled).toBe(false);
      expect(config.defaultAudience).toBeUndefined();
    });
  });
});
