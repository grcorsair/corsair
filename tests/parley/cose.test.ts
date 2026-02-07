/**
 * COSE_Sign1 Tests
 *
 * Tests for custom COSE_Sign1 implementation (RFC 9052).
 * Uses Ed25519 for signing, CBOR for encoding.
 * Zero external dependencies beyond Node.js crypto.
 */

import { describe, test, expect } from "bun:test";
import * as crypto from "crypto";
import { coseSign1, coseVerify1 } from "../../src/parley/cose";
import { cborDecode, type CBORValue } from "../../src/parley/cbor";

function generateEd25519Keypair(): { publicKeyPem: string; privateKeyPem: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKeyPem: publicKey, privateKeyPem: privateKey };
}

describe("COSE_Sign1", () => {
  const keypair = generateEd25519Keypair();
  const otherKeypair = generateEd25519Keypair();

  // =========================================================================
  // SIGN AND VERIFY ROUNDTRIP
  // =========================================================================
  describe("sign and verify roundtrip", () => {
    test("should sign and verify a simple payload", () => {
      const payload = Buffer.from("hello COSE");
      const signed = coseSign1(payload, keypair.privateKeyPem);
      const result = coseVerify1(signed, keypair.publicKeyPem);

      expect(result.verified).toBe(true);
      expect(result.payload.equals(payload)).toBe(true);
    });

    test("should sign and verify an empty payload", () => {
      const payload = Buffer.alloc(0);
      const signed = coseSign1(payload, keypair.privateKeyPem);
      const result = coseVerify1(signed, keypair.publicKeyPem);

      expect(result.verified).toBe(true);
      expect(result.payload.length).toBe(0);
    });

    test("should sign and verify a large payload", () => {
      const payload = Buffer.alloc(10000, 0x42);
      const signed = coseSign1(payload, keypair.privateKeyPem);
      const result = coseVerify1(signed, keypair.publicKeyPem);

      expect(result.verified).toBe(true);
      expect(result.payload.equals(payload)).toBe(true);
    });

    test("should sign and verify JSON payload", () => {
      const data = { type: "scitt-receipt", logId: "test-log", treeSize: 42 };
      const payload = Buffer.from(JSON.stringify(data));
      const signed = coseSign1(payload, keypair.privateKeyPem);
      const result = coseVerify1(signed, keypair.publicKeyPem);

      expect(result.verified).toBe(true);
      const parsed = JSON.parse(result.payload.toString());
      expect(parsed.type).toBe("scitt-receipt");
      expect(parsed.treeSize).toBe(42);
    });
  });

  // =========================================================================
  // TAMPERING DETECTION
  // =========================================================================
  describe("tampering detection", () => {
    test("should fail verification with tampered payload", () => {
      const payload = Buffer.from("original payload");
      const signed = coseSign1(payload, keypair.privateKeyPem);

      // Decode, tamper with payload, re-encode
      const decoded = cborDecode(signed) as CBORValue[];
      const tamperedPayload = Buffer.from("tampered payload");
      // Reconstruct with tampered payload but original signature
      const tampered = Buffer.alloc(signed.length + 10);
      // Instead of manual re-encoding, we'll just modify bytes in the signed buffer
      // A simpler approach: flip a bit in the payload area
      const signedCopy = Buffer.from(signed);
      // The payload is somewhere in the middle - find and modify it
      const originalStr = "original payload";
      const idx = signedCopy.indexOf(originalStr);
      if (idx >= 0) {
        signedCopy[idx] = signedCopy[idx]! ^ 0xff; // Flip bits
      }
      const result = coseVerify1(signedCopy, keypair.publicKeyPem);
      expect(result.verified).toBe(false);
    });

    test("should fail verification with tampered signature", () => {
      const payload = Buffer.from("test data");
      const signed = coseSign1(payload, keypair.privateKeyPem);

      // Tamper with the last few bytes (signature area)
      const tampered = Buffer.from(signed);
      tampered[tampered.length - 1] = tampered[tampered.length - 1]! ^ 0xff;
      tampered[tampered.length - 2] = tampered[tampered.length - 2]! ^ 0xff;

      const result = coseVerify1(tampered, keypair.publicKeyPem);
      expect(result.verified).toBe(false);
    });

    test("should fail verification with wrong key", () => {
      const payload = Buffer.from("test data");
      const signed = coseSign1(payload, keypair.privateKeyPem);
      const result = coseVerify1(signed, otherKeypair.publicKeyPem);

      expect(result.verified).toBe(false);
    });
  });

  // =========================================================================
  // COSE STRUCTURE VALIDATION
  // =========================================================================
  describe("COSE structure", () => {
    test("should produce valid CBOR-encoded COSE_Sign1 array", () => {
      const payload = Buffer.from("test");
      const signed = coseSign1(payload, keypair.privateKeyPem);
      const decoded = cborDecode(signed);

      // COSE_Sign1 is a 4-element array
      expect(Array.isArray(decoded)).toBe(true);
      const arr = decoded as CBORValue[];
      expect(arr.length).toBe(4);
    });

    test("should have CBOR-encoded protected headers as first element", () => {
      const payload = Buffer.from("test");
      const signed = coseSign1(payload, keypair.privateKeyPem);
      const decoded = cborDecode(signed) as CBORValue[];

      // First element is bstr (serialized protected headers)
      expect(Buffer.isBuffer(decoded[0])).toBe(true);

      // Decode the protected headers
      const protectedHeaders = cborDecode(decoded[0] as Buffer) as Map<CBORValue, CBORValue>;
      expect(protectedHeaders instanceof Map).toBe(true);
      // Algorithm label 1 = EdDSA (-8)
      expect(protectedHeaders.get(1)).toBe(-8);
    });

    test("should have empty unprotected headers as second element", () => {
      const payload = Buffer.from("test");
      const signed = coseSign1(payload, keypair.privateKeyPem);
      const decoded = cborDecode(signed) as CBORValue[];

      // Second element is empty map
      expect(decoded[1] instanceof Map).toBe(true);
      expect((decoded[1] as Map<CBORValue, CBORValue>).size).toBe(0);
    });

    test("should have payload as third element", () => {
      const payload = Buffer.from("test payload here");
      const signed = coseSign1(payload, keypair.privateKeyPem);
      const decoded = cborDecode(signed) as CBORValue[];

      // Third element is the payload bstr
      expect(Buffer.isBuffer(decoded[2])).toBe(true);
      expect((decoded[2] as Buffer).equals(payload)).toBe(true);
    });

    test("should have 64-byte Ed25519 signature as fourth element", () => {
      const payload = Buffer.from("test");
      const signed = coseSign1(payload, keypair.privateKeyPem);
      const decoded = cborDecode(signed) as CBORValue[];

      // Fourth element is signature bstr (Ed25519 = 64 bytes)
      expect(Buffer.isBuffer(decoded[3])).toBe(true);
      expect((decoded[3] as Buffer).length).toBe(64);
    });
  });

  // =========================================================================
  // CUSTOM PROTECTED HEADERS
  // =========================================================================
  describe("custom protected headers", () => {
    test("should accept custom protected headers", () => {
      const payload = Buffer.from("test");
      const customHeaders = new Map<number, number>([
        [1, -8],   // alg = EdDSA
        [33, 100], // some custom header
      ]);
      const signed = coseSign1(payload, keypair.privateKeyPem, customHeaders);
      const result = coseVerify1(signed, keypair.publicKeyPem);

      expect(result.verified).toBe(true);
      expect(result.payload.equals(payload)).toBe(true);
    });

    test("should default to EdDSA algorithm when no headers provided", () => {
      const payload = Buffer.from("test");
      const signed = coseSign1(payload, keypair.privateKeyPem);
      const decoded = cborDecode(signed) as CBORValue[];
      const protectedHeaders = cborDecode(decoded[0] as Buffer) as Map<CBORValue, CBORValue>;

      expect(protectedHeaders.get(1)).toBe(-8);
    });
  });
});
