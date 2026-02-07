/**
 * CBOR Encoder/Decoder Tests
 *
 * Tests for minimal CBOR implementation (RFC 8949 subset)
 * covering the types needed for COSE_Sign1: unsigned ints,
 * negative ints, byte strings, text strings, arrays, and maps.
 */

import { describe, test, expect } from "bun:test";
import { cborEncode, cborDecode, type CBORValue } from "../../src/parley/cbor";

describe("CBOR Encoder/Decoder", () => {
  // =========================================================================
  // UNSIGNED INTEGERS (Major Type 0)
  // =========================================================================
  describe("unsigned integers", () => {
    test("should roundtrip 0", () => {
      const encoded = cborEncode(0);
      expect(cborDecode(encoded)).toBe(0);
    });

    test("should roundtrip 1", () => {
      const encoded = cborEncode(1);
      expect(cborDecode(encoded)).toBe(1);
    });

    test("should roundtrip 23 (max single-byte additional info)", () => {
      const encoded = cborEncode(23);
      expect(cborDecode(encoded)).toBe(23);
    });

    test("should roundtrip 24 (requires 1-byte follow)", () => {
      const encoded = cborEncode(24);
      expect(cborDecode(encoded)).toBe(24);
    });

    test("should roundtrip 255 (max 1-byte)", () => {
      const encoded = cborEncode(255);
      expect(cborDecode(encoded)).toBe(255);
    });

    test("should roundtrip 256 (requires 2-byte follow)", () => {
      const encoded = cborEncode(256);
      expect(cborDecode(encoded)).toBe(256);
    });

    test("should roundtrip 65535 (max 2-byte)", () => {
      const encoded = cborEncode(65535);
      expect(cborDecode(encoded)).toBe(65535);
    });

    test("should roundtrip 65536 (requires 4-byte follow)", () => {
      const encoded = cborEncode(65536);
      expect(cborDecode(encoded)).toBe(65536);
    });

    test("should roundtrip 2^32 - 1 (max 4-byte)", () => {
      const encoded = cborEncode(4294967295);
      expect(cborDecode(encoded)).toBe(4294967295);
    });

    test("should encode 0 as single byte 0x00", () => {
      const encoded = cborEncode(0);
      expect(encoded[0]).toBe(0x00);
      expect(encoded.length).toBe(1);
    });

    test("should encode 10 as single byte 0x0a", () => {
      const encoded = cborEncode(10);
      expect(encoded[0]).toBe(0x0a);
      expect(encoded.length).toBe(1);
    });
  });

  // =========================================================================
  // NEGATIVE INTEGERS (Major Type 1)
  // =========================================================================
  describe("negative integers", () => {
    test("should roundtrip -1", () => {
      const encoded = cborEncode(-1);
      expect(cborDecode(encoded)).toBe(-1);
    });

    test("should roundtrip -24", () => {
      const encoded = cborEncode(-24);
      expect(cborDecode(encoded)).toBe(-24);
    });

    test("should roundtrip -25 (requires 1-byte follow)", () => {
      const encoded = cborEncode(-25);
      expect(cborDecode(encoded)).toBe(-25);
    });

    test("should roundtrip -256", () => {
      const encoded = cborEncode(-256);
      expect(cborDecode(encoded)).toBe(-256);
    });

    test("should roundtrip -65537", () => {
      const encoded = cborEncode(-65537);
      expect(cborDecode(encoded)).toBe(-65537);
    });

    test("should encode -1 as 0x20", () => {
      const encoded = cborEncode(-1);
      expect(encoded[0]).toBe(0x20);
      expect(encoded.length).toBe(1);
    });

    test("should encode -8 as 0x27 (needed for EdDSA alg)", () => {
      const encoded = cborEncode(-8);
      expect(encoded[0]).toBe(0x27);
      expect(encoded.length).toBe(1);
    });
  });

  // =========================================================================
  // BYTE STRINGS (Major Type 2)
  // =========================================================================
  describe("byte strings", () => {
    test("should roundtrip empty buffer", () => {
      const input = Buffer.alloc(0);
      const encoded = cborEncode(input);
      const decoded = cborDecode(encoded);
      expect(Buffer.isBuffer(decoded)).toBe(true);
      expect((decoded as Buffer).length).toBe(0);
    });

    test("should roundtrip short buffer", () => {
      const input = Buffer.from([0x01, 0x02, 0x03]);
      const encoded = cborEncode(input);
      const decoded = cborDecode(encoded) as Buffer;
      expect(Buffer.isBuffer(decoded)).toBe(true);
      expect(decoded.equals(input)).toBe(true);
    });

    test("should roundtrip longer buffer (> 23 bytes)", () => {
      const input = Buffer.alloc(100, 0xab);
      const encoded = cborEncode(input);
      const decoded = cborDecode(encoded) as Buffer;
      expect(decoded.equals(input)).toBe(true);
    });

    test("should roundtrip 256 byte buffer", () => {
      const input = Buffer.alloc(256, 0xcd);
      const encoded = cborEncode(input);
      const decoded = cborDecode(encoded) as Buffer;
      expect(decoded.equals(input)).toBe(true);
    });
  });

  // =========================================================================
  // TEXT STRINGS (Major Type 3)
  // =========================================================================
  describe("text strings", () => {
    test("should roundtrip empty string", () => {
      const encoded = cborEncode("");
      expect(cborDecode(encoded)).toBe("");
    });

    test("should roundtrip 'hello'", () => {
      const encoded = cborEncode("hello");
      expect(cborDecode(encoded)).toBe("hello");
    });

    test("should roundtrip 'Signature1' (COSE context string)", () => {
      const encoded = cborEncode("Signature1");
      expect(cborDecode(encoded)).toBe("Signature1");
    });

    test("should roundtrip unicode string", () => {
      const input = "Hello \u{1F3F4}\u200D\u2620\uFE0F"; // pirate flag
      const encoded = cborEncode(input);
      expect(cborDecode(encoded)).toBe(input);
    });

    test("should roundtrip long string (> 256 chars)", () => {
      const input = "a".repeat(300);
      const encoded = cborEncode(input);
      expect(cborDecode(encoded)).toBe(input);
    });
  });

  // =========================================================================
  // ARRAYS (Major Type 4)
  // =========================================================================
  describe("arrays", () => {
    test("should roundtrip empty array", () => {
      const encoded = cborEncode([]);
      expect(cborDecode(encoded)).toEqual([]);
    });

    test("should roundtrip array of integers", () => {
      const input = [1, 2, 3];
      const encoded = cborEncode(input);
      expect(cborDecode(encoded)).toEqual(input);
    });

    test("should roundtrip nested arrays", () => {
      const input = [1, [2, 3], [4, [5]]];
      const encoded = cborEncode(input);
      expect(cborDecode(encoded)).toEqual(input);
    });

    test("should roundtrip mixed type array", () => {
      const input: CBORValue[] = [1, "hello", Buffer.from([0xab])];
      const encoded = cborEncode(input);
      const decoded = cborDecode(encoded) as CBORValue[];
      expect(Array.isArray(decoded)).toBe(true);
      expect(decoded[0]).toBe(1);
      expect(decoded[1]).toBe("hello");
      expect(Buffer.isBuffer(decoded[2])).toBe(true);
      expect((decoded[2] as Buffer).equals(Buffer.from([0xab]))).toBe(true);
    });

    test("should roundtrip COSE Sig_structure shape", () => {
      // ["Signature1", protectedSerialized, external_aad, payload]
      const input: CBORValue[] = [
        "Signature1",
        Buffer.from([0xa1, 0x01, 0x27]),
        Buffer.alloc(0),
        Buffer.from("test payload"),
      ];
      const encoded = cborEncode(input);
      const decoded = cborDecode(encoded) as CBORValue[];
      expect(decoded[0]).toBe("Signature1");
      expect(Buffer.isBuffer(decoded[1])).toBe(true);
      expect(Buffer.isBuffer(decoded[2])).toBe(true);
      expect(Buffer.isBuffer(decoded[3])).toBe(true);
    });
  });

  // =========================================================================
  // MAPS (Major Type 5)
  // =========================================================================
  describe("maps", () => {
    test("should roundtrip empty map", () => {
      const input = new Map<CBORValue, CBORValue>();
      const encoded = cborEncode(input);
      const decoded = cborDecode(encoded) as Map<CBORValue, CBORValue>;
      expect(decoded instanceof Map).toBe(true);
      expect(decoded.size).toBe(0);
    });

    test("should roundtrip map with integer keys", () => {
      const input = new Map<CBORValue, CBORValue>([[1, -8]]);
      const encoded = cborEncode(input);
      const decoded = cborDecode(encoded) as Map<CBORValue, CBORValue>;
      expect(decoded instanceof Map).toBe(true);
      expect(decoded.get(1)).toBe(-8);
    });

    test("should roundtrip COSE protected headers { 1: -8 }", () => {
      // This is the exact map used in COSE_Sign1 for EdDSA
      const input = new Map<CBORValue, CBORValue>([[1, -8]]);
      const encoded = cborEncode(input);
      const decoded = cborDecode(encoded) as Map<CBORValue, CBORValue>;
      expect(decoded.get(1)).toBe(-8);
    });

    test("should roundtrip map with mixed value types", () => {
      const input = new Map<CBORValue, CBORValue>([
        [1, "hello"],
        [2, Buffer.from([0xab])],
        [3, 42],
      ]);
      const encoded = cborEncode(input);
      const decoded = cborDecode(encoded) as Map<CBORValue, CBORValue>;
      expect(decoded.get(1)).toBe("hello");
      expect(Buffer.isBuffer(decoded.get(2))).toBe(true);
      expect(decoded.get(3)).toBe(42);
    });
  });

  // =========================================================================
  // ENCODING SIZE VERIFICATION
  // =========================================================================
  describe("encoding efficiency", () => {
    test("should use 1 byte for integers 0-23", () => {
      for (let i = 0; i <= 23; i++) {
        expect(cborEncode(i).length).toBe(1);
      }
    });

    test("should use 2 bytes for integers 24-255", () => {
      expect(cborEncode(24).length).toBe(2);
      expect(cborEncode(255).length).toBe(2);
    });

    test("should use 3 bytes for integers 256-65535", () => {
      expect(cborEncode(256).length).toBe(3);
      expect(cborEncode(65535).length).toBe(3);
    });

    test("should use 5 bytes for integers 65536-4294967295", () => {
      expect(cborEncode(65536).length).toBe(5);
      expect(cborEncode(4294967295).length).toBe(5);
    });
  });
});
