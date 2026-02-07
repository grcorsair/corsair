/**
 * Custom COSE_Sign1 Implementation (RFC 9052)
 *
 * Zero external dependencies. Uses Node.js crypto for Ed25519
 * and the local CBOR encoder/decoder.
 *
 * COSE_Sign1 = [
 *   protected : bstr,        -- CBOR-encoded protected headers
 *   unprotected : map,       -- Unprotected headers (empty)
 *   payload : bstr | nil,    -- The data being signed
 *   signature : bstr         -- Ed25519 signature
 * ]
 */

import * as crypto from "crypto";
import { cborEncode, cborDecode, type CBORValue } from "./cbor";

/**
 * Create a COSE_Sign1 signed structure.
 *
 * @param payload - The data to sign
 * @param privateKeyPem - Ed25519 private key in PEM format (PKCS#8)
 * @param protectedHeaders - Optional custom protected headers map (int keys to int values).
 *                           Defaults to { 1: -8 } (alg = EdDSA).
 * @returns CBOR-encoded COSE_Sign1 structure
 */
export function coseSign1(
  payload: Buffer,
  privateKeyPem: string,
  protectedHeaders?: Map<number, number>,
): Buffer {
  // Build protected headers: default { 1: -8 } = alg: EdDSA
  const headers = new Map<CBORValue, CBORValue>();
  if (protectedHeaders) {
    for (const [k, v] of protectedHeaders) {
      headers.set(k, v);
    }
  } else {
    headers.set(1, -8);
  }

  // Serialize protected headers to CBOR
  const protectedSerialized = cborEncode(headers);

  // Build Sig_structure:
  // ["Signature1", protectedSerialized, external_aad (empty), payload]
  const sigStructure: CBORValue[] = [
    "Signature1",
    protectedSerialized,
    Buffer.alloc(0),
    payload,
  ];
  const sigStructureEncoded = cborEncode(sigStructure);

  // Sign with Ed25519
  const signature = crypto.sign(null, sigStructureEncoded, {
    key: privateKeyPem,
    format: "pem",
    type: "pkcs8",
  });

  // Build COSE_Sign1 array:
  // [protectedSerialized, emptyMap, payload, signature]
  const coseArray: CBORValue[] = [
    protectedSerialized,
    new Map<CBORValue, CBORValue>(),
    payload,
    Buffer.from(signature),
  ];

  return cborEncode(coseArray);
}

/**
 * Verify a COSE_Sign1 structure.
 *
 * @param coseBytes - CBOR-encoded COSE_Sign1 structure
 * @param publicKeyPem - Ed25519 public key in PEM format (SPKI)
 * @returns Object with verified boolean and the payload buffer
 */
export function coseVerify1(
  coseBytes: Buffer,
  publicKeyPem: string,
): { verified: boolean; payload: Buffer } {
  try {
    // Decode COSE_Sign1 array
    const decoded = cborDecode(coseBytes);
    if (!Array.isArray(decoded) || decoded.length !== 4) {
      return { verified: false, payload: Buffer.alloc(0) };
    }

    const [protectedSerialized, , payload, signature] = decoded;

    if (!Buffer.isBuffer(protectedSerialized) || !Buffer.isBuffer(payload) || !Buffer.isBuffer(signature)) {
      return { verified: false, payload: Buffer.alloc(0) };
    }

    // Rebuild Sig_structure
    const sigStructure: CBORValue[] = [
      "Signature1",
      protectedSerialized,
      Buffer.alloc(0),
      payload,
    ];
    const sigStructureEncoded = cborEncode(sigStructure);

    // Verify Ed25519 signature
    const verified = crypto.verify(
      null,
      sigStructureEncoded,
      { key: publicKeyPem, format: "pem", type: "spki" },
      signature,
    );

    return { verified, payload };
  } catch {
    return { verified: false, payload: Buffer.alloc(0) };
  }
}
