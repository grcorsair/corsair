/**
 * SET Generator - Security Event Token Generation
 *
 * Generates signed Security Event Tokens (SETs) per RFC 8417 for
 * FLAGSHIP events. Uses the same Ed25519 keypair as MARQUE signing,
 * via the jose library for JWT operations.
 *
 * SETs carry CAEP event data (compliance changes, trust tier transitions,
 * CPOE lifecycle events) as signed JWTs for tamper-proof delivery.
 */

import { SignJWT, jwtVerify, importPKCS8, importSPKI } from "jose";
import * as crypto from "crypto";
import type { MarqueKeyManager } from "../parley/marque-key-manager";
import type {
  FlagshipEvent,
  SETPayload,
  FlagshipEventType,
  CAEPEventData,
  ColorsChangedData,
  FleetAlertData,
  PapersChangedData,
  MarqueRevokedData,
} from "./flagship-types";
import { FLAGSHIP_EVENTS } from "./flagship-types";

/**
 * Generate a signed Security Event Token (SET) for a FLAGSHIP event.
 * Uses the same Ed25519 keypair as MARQUE signing.
 *
 * @param event - The FLAGSHIP event to encode
 * @param issuerDID - Issuer DID (e.g., "did:web:grcorsair.com")
 * @param audience - Audience DID (e.g., "did:web:partner.example.com")
 * @param keyManager - MarqueKeyManager instance with loaded keypair
 * @returns Signed JWT string (compact serialization)
 */
export async function generateSET(
  event: FlagshipEvent,
  issuerDID: string,
  audience: string,
  keyManager: MarqueKeyManager,
): Promise<string> {
  // Load private key from keyManager
  const keypair = await keyManager.loadKeypair();
  if (!keypair) {
    throw new Error("No keypair found. Generate a keypair first.");
  }

  // Import PEM private key for jose
  const privateKey = await importPKCS8(
    keypair.privateKey.toString(),
    "EdDSA",
  );

  // Build SET payload: events keyed by event type URI
  const jti = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  const jwt = await new SignJWT({
    events: {
      [event.type]: event.data,
    },
  })
    .setProtectedHeader({ alg: "EdDSA", typ: "secevent+jwt" })
    .setIssuer(issuerDID)
    .setAudience(audience)
    .setIssuedAt(now)
    .setJti(jti)
    .sign(privateKey);

  return jwt;
}

/**
 * Verify a SET token's signature using the keyManager's public key.
 *
 * @param jwt - The SET JWT string to verify
 * @param keyManager - MarqueKeyManager with the signing public key
 * @returns Verification result with validity flag and decoded payload
 */
/**
 * Generate a plain-English description for a FLAGSHIP event.
 * Designed for GRC staff, vendors, and auditors — NOT engineers.
 *
 * @param event - The FLAGSHIP event to describe
 * @returns Human-readable description of what changed and why it matters
 */
export function generateFlagshipDescription(event: FlagshipEvent): string {
  const marqueId = event.data.subject.corsair.marqueId;
  const provider = event.data.subject.corsair.provider;
  const providerNote = provider ? ` for ${provider}` : "";

  switch (event.type) {
    case FLAGSHIP_EVENTS.COLORS_CHANGED: {
      const data = event.data as ColorsChangedData;
      const direction = data.change_direction === "increase" ? "upgraded" : "downgraded";
      return `Assurance level ${direction} from "${data.previous_level}" to "${data.current_level}"${providerNote}. ` +
        `CPOE ${marqueId} now reflects ${data.change_direction === "increase" ? "stronger" : "weaker"} evidence of control effectiveness.`;
    }

    case FLAGSHIP_EVENTS.FLEET_ALERT: {
      const data = event.data as FleetAlertData;
      const controlList = data.affected_controls.join(", ");
      return `Compliance drift detected${providerNote}: ${data.drift_type} (${data.severity} severity). ` +
        `Affected controls: ${controlList}. CPOE ${marqueId} may require reassessment.`;
    }

    case FLAGSHIP_EVENTS.PAPERS_CHANGED: {
      const data = event.data as PapersChangedData;
      const actionMap: Record<string, string> = {
        issued: "A new CPOE has been issued",
        renewed: "The CPOE has been renewed with updated evidence",
        revoked: "The CPOE has been revoked and should no longer be trusted",
        expired: "The CPOE has expired and should be renewed",
      };
      return `${actionMap[data.change_type] ?? "CPOE status changed"}${providerNote}. ` +
        `CPOE ${marqueId} (${data.credential_type}).`;
    }

    case FLAGSHIP_EVENTS.MARQUE_REVOKED: {
      const data = event.data as MarqueRevokedData;
      const revokedAt = new Date(data.revocation_timestamp * 1000).toISOString();
      return `EMERGENCY: CPOE ${marqueId} has been revoked by ${data.initiator}. ` +
        `Reason: ${data.reason}. Revoked at ${revokedAt}. This CPOE should no longer be accepted.`;
    }

    default:
      return `FLAGSHIP event for CPOE ${marqueId}${providerNote}.`;
  }
}

export async function verifySET(
  jwt: string,
  keyManager: MarqueKeyManager,
): Promise<{ valid: boolean; payload?: SETPayload }> {
  try {
    const keypair = await keyManager.loadKeypair();
    if (!keypair) {
      return { valid: false };
    }

    const publicKey = await importSPKI(
      keypair.publicKey.toString(),
      "EdDSA",
    );

    const { payload } = await jwtVerify(jwt, publicKey);
    return {
      valid: true,
      payload: payload as unknown as SETPayload,
    };
  } catch {
    return { valid: false };
  }
}
