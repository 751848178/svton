// Test-only PNG fixture builders shared by browser-artifact and CDP self-tests.
//
// Responsibility: assemble real, structurally valid PNG buffers (and a few
// intentionally malformed ones) so tests do not rely on signature+padding
// blobs. The production PNG validator owns CRC/chunk parsing; this helper only
// constructs fixtures and is imported solely by self-tests.
import { deflateSync } from "node:zlib";
import { pngCrc32 } from "./parity-history-png-crc32.mjs";

export const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

// A complete 1x1 RGB PNG with a real zlib-compressed scanline and a harmless
// tEXt chunk large enough to clear the screenshot minimum.
export function buildValidScreenshotPng() {
  const textBody = Buffer.concat([
    Buffer.from("Comment\0", "ascii"),
    Buffer.alloc(120, 0x41),
  ]);
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", buildIhdrBody()),
    pngChunk("IDAT", deflateSync(Buffer.from([0, 0x20, 0x40, 0x60]))),
    pngChunk("tEXt", textBody),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// Build a stream of `count` legal tEXt chunks after IHDR, with no IEND. With
// count=255 and a 1-byte body this reproduces the exact 3348-byte fixture the
// rejected validator accepted: signature + IHDR + 255 valid tEXt chunks.
export function buildPngWithoutIend(count = 255) {
  const chunks = Array.from({ length: count }, () =>
    pngChunk("tEXt", Buffer.from("a")),
  );
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", buildIhdrBody()),
    ...chunks,
  ]);
}

// A chunk with a deliberately wrong CRC, for CRC-corruption fixtures.
export function pngChunkWithBadCrc(type, body) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length, 0);
  const typeBuffer = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(0, 0);
  return Buffer.concat([length, typeBuffer, body, crc]);
}

export function buildIhdrBody() {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0); // width
  ihdr.writeUInt32BE(1, 4); // height
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  return ihdr;
}

export function pngChunk(type, body) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length, 0);
  const typeBuffer = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(pngCrc32(Buffer.concat([typeBuffer, body])), 0);
  return Buffer.concat([length, typeBuffer, body, crc]);
}
