/**
 * FLAGSHIP Types - SSF/SET/CAEP Event System
 *
 * Defines the type system for the FLAGSHIP module, which implements
 * OpenID SSF (Shared Signals Framework), SET (Security Event Tokens),
 * and CAEP (Continuous Access Evaluation Protocol) for real-time
 * compliance change notifications.
 *
 * Pirate name: FLAGSHIP -- the command ship that signals fleet-wide
 * status changes. When the flagship raises new colors, the fleet responds.
 *
 * Spec references:
 * - SSF: https://openid.net/specs/openid-sharedsignals-framework-1_0.html
 * - SET: RFC 8417
 * - CAEP: https://openid.net/specs/openid-caep-1_0.html
 */

// =============================================================================
// CAEP EVENT TYPES (Pirate-Aliased)
// =============================================================================

/**
 * CAEP event type URIs with pirate aliases.
 * Each maps a Corsair concept to a CAEP-compliant event URI.
 */
export const FLAGSHIP_EVENTS = {
  /** Evidence signal changed (colors raised or lowered) */
  COLORS_CHANGED: "https://grcorsair.com/events/colors-changed/v1",

  /** Drift detected, controls degraded */
  FLEET_ALERT: "https://grcorsair.com/events/compliance-change/v1",

  /** CPOE issued, renewed, or revoked */
  PAPERS_CHANGED: "https://grcorsair.com/events/credential-change/v1",

  /** Emergency CPOE revocation */
  MARQUE_REVOKED: "https://grcorsair.com/events/session-revoked/v1",
} as const;

export type FlagshipEventType =
  (typeof FLAGSHIP_EVENTS)[keyof typeof FLAGSHIP_EVENTS];

// =============================================================================
// SUBJECT FORMAT
// =============================================================================

/**
 * CAEP subject format identifying who/what the event is about.
 * Uses SSF "complex" subject format with a Corsair-specific namespace.
 */
export interface FlagshipSubject {
  format: "complex";
  corsair: {
    marqueId: string;
    provider?: string;
    criterion?: string;
  };
}

// =============================================================================
// EVENT DATA TYPES
// =============================================================================

/**
 * Base event data shared by all CAEP events.
 */
export interface CAEPEventData {
  subject: FlagshipSubject;
  event_timestamp: number; // Unix timestamp
  [key: string]: unknown;
}

/**
 * FLEET_ALERT: Drift detected (compliance-change).
 * Fired when MARK detects configuration drift that degrades controls.
 */
export interface FleetAlertData extends CAEPEventData {
  drift_type: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  affected_controls: string[];
}

/**
 * COLORS_CHANGED: Evidence signal changed (colors raised/lowered).
 * Fired when evidence quality or provenance strength changes.
 */
export interface ColorsChangedData extends CAEPEventData {
  previous_level: string;
  current_level: string;
  change_direction: "increase" | "decrease";
}

/**
 * PAPERS_CHANGED: CPOE lifecycle event (credential-change).
 * Fired when a CPOE is issued, renewed, revoked, or expired.
 */
export interface PapersChangedData extends CAEPEventData {
  credential_type: "CorsairCPOE";
  change_type: "issued" | "renewed" | "revoked" | "expired";
}

/**
 * MARQUE_REVOKED: Emergency CPOE revocation (session-revoked).
 * Fired when a CPOE is revoked due to evidence tampering or critical failure.
 */
export interface MarqueRevokedData extends CAEPEventData {
  reason: string;
  revocation_timestamp: number;
  initiator: string;
}

// =============================================================================
// FLAGSHIP EVENT WRAPPER
// =============================================================================

/**
 * Union wrapper for any FLAGSHIP event.
 */
export interface FlagshipEvent {
  type: FlagshipEventType;
  data: CAEPEventData;
}

// =============================================================================
// SET (Security Event Token) JWT
// =============================================================================

/**
 * SET JWT payload per RFC 8417.
 * Events are keyed by their CAEP event URI.
 */
export interface SETPayload {
  iss: string; // Issuer DID
  iat: number; // Issued at
  jti: string; // Unique ID
  aud: string; // Audience
  events: Record<string, CAEPEventData>; // CAEP event data keyed by event URI
}

// =============================================================================
// SSF STREAM CONFIGURATION
// =============================================================================

/**
 * SSF Stream delivery and subscription configuration.
 */
export interface SSFStreamConfig {
  delivery: {
    method: "push" | "poll";
    endpoint_url?: string; // Required for push
  };
  events_requested: FlagshipEventType[];
  format: "jwt";
  audience?: string;
}

/**
 * SSF Stream instance with lifecycle status.
 */
export interface SSFStream {
  streamId: string;
  status: "active" | "paused" | "deleted";
  config: SSFStreamConfig;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// FLAGSHIP CONFIG (Parley Integration)
// =============================================================================

/**
 * Configuration for FLAGSHIP integration with Parley.
 */
export interface FlagshipConfig {
  enabled: boolean;
  issuerDID: string;
  defaultAudience?: string;
}
