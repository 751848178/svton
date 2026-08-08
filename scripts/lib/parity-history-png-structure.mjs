// Structural PNG validation for browser screenshot artifacts.
//
// Responsibility: confirm a buffer carries a complete, well-formed PNG byte
// stream -- the 8-byte signature, an IHDR-first chunk sequence with verifying
// CRCs, and a terminating IEND chunk with no trailing bytes. It performs no
// pixel or color-type interpretation, so it accepts any structurally valid PNG
// and rejects padding-only blobs, truncated streams, broken CRCs and streams
// missing their terminating IEND.
import { inflateSync } from "node:zlib";
import { pngCrc32 } from "./parity-history-png-crc32.mjs";

export const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const CHUNK_HEADER = 8; // 4-byte length + 4-byte type
const CRC_BYTES = 4;
const IHDR_BODY_LENGTH = 13;
const IHDR = asciiBytes("IHDR");
const IEND = asciiBytes("IEND");
const IDAT = asciiBytes("IDAT");
const PLTE = asciiBytes("PLTE");
const MAX_DECODED_BYTES = 256 * 1024 * 1024;

function asciiBytes(text) {
  return Array.from(text, (char) => char.charCodeAt(0));
}

export function hasValidPngStructure(buffer) {
  if (!Buffer.isBuffer(buffer)) return false;
  if (buffer.length < PNG_SIGNATURE.length) return false;
  if (!buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    return false;
  }
  return chunkStreamTerminates(buffer, PNG_SIGNATURE.length);
}

// Walk the chunk stream from `offset`. Unlike an iteration-capped scan, this
// terminates the moment it consumes an IEND chunk and then verifies nothing
// follows it. A stream that exhausts before reaching IEND (including the
// accepted-once IHDR + many legal chunks case) therefore returns false.
function chunkStreamTerminates(buffer, offset) {
  let header = null;
  let sawPlte = false;
  let sawIdat = false;
  let idatEnded = false;
  const idatBodies = [];
  while (true) {
    const next = readChunk(buffer, offset);
    if (next === null) return false;
    const { type, end } = next;
    const first = offset === PNG_SIGNATURE.length;
    if (first) {
      if (!equalsType(type, IHDR) || next.length !== IHDR_BODY_LENGTH) {
        return false;
      }
      header = readHeader(next.body);
      if (header === null) return false;
    } else if (equalsType(type, IHDR)) {
      return false;
    }
    if (equalsType(type, PLTE)) {
      if (sawPlte || sawIdat || !validPalette(next.body)) return false;
      sawPlte = true;
    } else if (equalsType(type, IDAT)) {
      if (idatEnded || next.length === 0) return false;
      sawIdat = true;
      idatBodies.push(next.body);
    } else if (sawIdat && !equalsType(type, IEND)) {
      idatEnded = true;
    }
    if (isUnknownCritical(type)) return false;
    if (header?.colorType === 3 && equalsType(type, IEND) && !sawPlte) {
      return false;
    }
    offset = end;
    if (equalsType(type, IEND)) {
      return (
        header !== null &&
        sawIdat &&
        next.length === 0 &&
        offset === buffer.length &&
        validImageData(header, idatBodies)
      );
    }
  }
}

// Decode one chunk at `offset`: validate its type letters, length bounds and
// CRC, then report its type, declared length and the offset just past its CRC.
// Returns null on any structural fault (truncated header, out-of-range length,
// bad type letters, mismatched CRC) so the caller treats the stream as invalid.
function readChunk(buffer, offset) {
  if (offset + CHUNK_HEADER > buffer.length) return null;
  const length = buffer.readUInt32BE(offset);
  const type = buffer.subarray(offset + 4, offset + CHUNK_HEADER);
  if (!isChunkType(type)) return null;
  const bodyStart = offset + CHUNK_HEADER;
  const crcStart = bodyStart + length;
  const end = crcStart + CRC_BYTES;
  // length alone can overflow before `end` does; guard both, then the CRC fit.
  if (length > buffer.length || end > buffer.length) return null;
  const body = buffer.subarray(bodyStart, crcStart);
  const crcInput = buffer.subarray(offset + 4, crcStart);
  const stored = buffer.readUInt32BE(crcStart);
  if (pngCrc32(crcInput) !== stored) return null;
  return { type, length, body, end };
}

function readHeader(body) {
  const width = body.readUInt32BE(0);
  const height = body.readUInt32BE(4);
  const bitDepth = body[8];
  const colorType = body[9];
  const samples = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  const allowedDepths = {
    0: [1, 2, 4, 8, 16],
    2: [8, 16],
    3: [1, 2, 4, 8],
    4: [8, 16],
    6: [8, 16],
  }[colorType];
  if (
    width === 0 ||
    height === 0 ||
    !samples ||
    !allowedDepths.includes(bitDepth) ||
    body[10] !== 0 ||
    body[11] !== 0 ||
    body[12] !== 0
  ) {
    return null;
  }
  const rowBytes = Math.ceil((width * samples * bitDepth) / 8);
  const decodedBytes = height * (rowBytes + 1);
  if (!Number.isSafeInteger(decodedBytes) || decodedBytes > MAX_DECODED_BYTES) {
    return null;
  }
  return { colorType, height, rowBytes, decodedBytes };
}

function validPalette(body) {
  return body.length >= 3 && body.length <= 768 && body.length % 3 === 0;
}

function validImageData(header, bodies) {
  try {
    const decoded = inflateSync(Buffer.concat(bodies), {
      maxOutputLength: header.decodedBytes,
    });
    if (decoded.length !== header.decodedBytes) return false;
    for (let row = 0; row < header.height; row += 1) {
      if (decoded[row * (header.rowBytes + 1)] > 4) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function isUnknownCritical(type) {
  const critical = type[0] >= 0x41 && type[0] <= 0x5a;
  return (
    critical &&
    !equalsType(type, IHDR) &&
    !equalsType(type, PLTE) &&
    !equalsType(type, IDAT) &&
    !equalsType(type, IEND)
  );
}

function isChunkType(type) {
  for (let index = 0; index < 4; index += 1) {
    const code = type[index];
    const isLetter =
      (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a);
    if (!isLetter) return false;
  }
  return type[2] >= 0x41 && type[2] <= 0x5a;
}

function equalsType(type, codes) {
  return (
    type[0] === codes[0] &&
    type[1] === codes[1] &&
    type[2] === codes[2] &&
    type[3] === codes[3]
  );
}
