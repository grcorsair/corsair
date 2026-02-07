/**
 * Minimal CBOR Encoder/Decoder (RFC 8949 subset)
 *
 * Zero dependencies. Only the subset needed for COSE_Sign1:
 * unsigned ints, negative ints, byte strings, text strings, arrays, maps.
 */

export type CBORValue = number | string | Buffer | CBORValue[] | Map<CBORValue, CBORValue>;

// Major type constants (shifted into high 3 bits)
const MT_UNSIGNED = 0x00;
const MT_NEGATIVE = 0x20;
const MT_BYTES    = 0x40;
const MT_TEXT     = 0x60;
const MT_ARRAY    = 0x80;
const MT_MAP      = 0xa0;

// =============================================================================
// ENCODER
// =============================================================================

function encodeHead(majorType: number, value: number): Buffer {
  if (value < 0 || !Number.isInteger(value)) {
    throw new Error(`Invalid CBOR head value: ${value}`);
  }
  if (value <= 23) {
    return Buffer.from([majorType | value]);
  }
  if (value <= 0xff) {
    return Buffer.from([majorType | 24, value]);
  }
  if (value <= 0xffff) {
    const buf = Buffer.alloc(3);
    buf[0] = majorType | 25;
    buf.writeUInt16BE(value, 1);
    return buf;
  }
  if (value <= 0xffffffff) {
    const buf = Buffer.alloc(5);
    buf[0] = majorType | 26;
    buf.writeUInt32BE(value, 1);
    return buf;
  }
  throw new Error(`Value too large for 32-bit CBOR encoding: ${value}`);
}

function encodeValue(value: CBORValue): Buffer {
  // Number (integer)
  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new Error("CBOR encoder only supports integers");
    }
    if (value >= 0) {
      return encodeHead(MT_UNSIGNED, value);
    }
    // Negative: CBOR encodes -1 as 0, -2 as 1, etc.
    return encodeHead(MT_NEGATIVE, -1 - value);
  }

  // Text string
  if (typeof value === "string") {
    const utf8 = Buffer.from(value, "utf-8");
    const head = encodeHead(MT_TEXT, utf8.length);
    return Buffer.concat([head, utf8]);
  }

  // Byte string (Buffer)
  if (Buffer.isBuffer(value)) {
    const head = encodeHead(MT_BYTES, value.length);
    return Buffer.concat([head, value]);
  }

  // Array
  if (Array.isArray(value)) {
    const head = encodeHead(MT_ARRAY, value.length);
    const items = value.map(encodeValue);
    return Buffer.concat([head, ...items]);
  }

  // Map
  if (value instanceof Map) {
    const head = encodeHead(MT_MAP, value.size);
    const entries: Buffer[] = [];
    for (const [k, v] of value) {
      entries.push(encodeValue(k));
      entries.push(encodeValue(v));
    }
    return Buffer.concat([head, ...entries]);
  }

  throw new Error(`Unsupported CBOR value type: ${typeof value}`);
}

export function cborEncode(value: CBORValue): Buffer {
  return encodeValue(value);
}

// =============================================================================
// DECODER
// =============================================================================

interface DecodeResult {
  value: CBORValue;
  bytesRead: number;
}

function decodeHead(data: Buffer, offset: number): { majorType: number; additionalInfo: number; value: number; headSize: number } {
  if (offset >= data.length) {
    throw new Error("Unexpected end of CBOR data");
  }

  const initial = data[offset]!;
  const majorType = initial & 0xe0; // high 3 bits
  const additionalInfo = initial & 0x1f; // low 5 bits

  if (additionalInfo <= 23) {
    return { majorType, additionalInfo, value: additionalInfo, headSize: 1 };
  }

  if (additionalInfo === 24) {
    if (offset + 1 >= data.length) throw new Error("Unexpected end of CBOR data");
    return { majorType, additionalInfo, value: data[offset + 1]!, headSize: 2 };
  }

  if (additionalInfo === 25) {
    if (offset + 2 >= data.length) throw new Error("Unexpected end of CBOR data");
    return { majorType, additionalInfo, value: data.readUInt16BE(offset + 1), headSize: 3 };
  }

  if (additionalInfo === 26) {
    if (offset + 4 >= data.length) throw new Error("Unexpected end of CBOR data");
    return { majorType, additionalInfo, value: data.readUInt32BE(offset + 1), headSize: 5 };
  }

  throw new Error(`Unsupported CBOR additional info: ${additionalInfo}`);
}

function decodeAt(data: Buffer, offset: number): DecodeResult {
  const { majorType, value, headSize } = decodeHead(data, offset);

  switch (majorType) {
    case MT_UNSIGNED:
      return { value, bytesRead: headSize };

    case MT_NEGATIVE:
      return { value: -1 - value, bytesRead: headSize };

    case MT_BYTES: {
      const bytes = data.subarray(offset + headSize, offset + headSize + value);
      return { value: Buffer.from(bytes), bytesRead: headSize + value };
    }

    case MT_TEXT: {
      const text = data.subarray(offset + headSize, offset + headSize + value).toString("utf-8");
      return { value: text, bytesRead: headSize + value };
    }

    case MT_ARRAY: {
      const arr: CBORValue[] = [];
      let pos = offset + headSize;
      for (let i = 0; i < value; i++) {
        const item = decodeAt(data, pos);
        arr.push(item.value);
        pos += item.bytesRead;
      }
      return { value: arr, bytesRead: pos - offset };
    }

    case MT_MAP: {
      const map = new Map<CBORValue, CBORValue>();
      let pos = offset + headSize;
      for (let i = 0; i < value; i++) {
        const keyResult = decodeAt(data, pos);
        pos += keyResult.bytesRead;
        const valResult = decodeAt(data, pos);
        pos += valResult.bytesRead;
        map.set(keyResult.value, valResult.value);
      }
      return { value: map, bytesRead: pos - offset };
    }

    default:
      throw new Error(`Unsupported CBOR major type: ${majorType >> 5}`);
  }
}

export function cborDecode(data: Buffer): CBORValue {
  const result = decodeAt(data, 0);
  return result.value;
}
