// Structural PNG validation for browser screenshot artifacts.
//
// Responsibility: confirm a buffer carries a complete, well-formed PNG byte
// stream -- the 8-byte signature, an IHDR-first chunk sequence with verifying
// CRCs, and a terminating IEND chunk with no trailing bytes. It performs no
// pixel or color-type interpretation, so it accepts any structurally valid PNG
// and rejects padding-only blobs, truncated streams, broken CRCs and streams
// missing their terminating IEND.
import { crc32 } from "node:zlib";

export const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const CHUNK_HEADER = 8; // 4-byte length + 4-byte type
const CRC_BYTES = 4;
const IHDR_BODY_LENGTH = 13;
const IHDR = asciiBytes("IHDR");
const IEND = asciiBytes("IEND");

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
  let sawIhdr = false;
  while (true) {
    const next = readChunk(buffer, offset);
    if (next === null) return false;
    const { type, end } = next;
    if (offset === PNG_SIGNATURE.length) {
      if (!equalsType(type, IHDR) || next.length !== IHDR_BODY_LENGTH) {
        return false;
      }
      sawIhdr = true;
    }
    offset = end;
    if (equalsType(type, IEND)) {
      return sawIhdr && next.length === 0 && offset === buffer.length;
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
  const crcInput = buffer.subarray(offset + 4, crcStart);
  const stored = buffer.readUInt32BE(crcStart);
  if (crc32(crcInput) >>> 0 !== stored) return null;
  return { type, length, end };
}

function isChunkType(type) {
  for (let index = 0; index < 4; index += 1) {
    const code = type[index];
    const isLetter =
      (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a);
    if (!isLetter) return false;
  }
  return true;
}

function equalsType(type, codes) {
  return (
    type[0] === codes[0] &&
    type[1] === codes[1] &&
    type[2] === codes[2] &&
    type[3] === codes[3]
  );
}
