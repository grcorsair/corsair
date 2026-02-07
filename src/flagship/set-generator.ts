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
import type { FlagshipEvent, SETPayload } from "./flagship-types";

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
