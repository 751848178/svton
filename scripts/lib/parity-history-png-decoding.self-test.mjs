#!/usr/bin/env node
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { pngCrc32 } from "./parity-history-png-crc32.mjs";
import { hasValidPngStructure } from "./parity-history-png-structure.mjs";
import {
  PNG_SIGNATURE,
  buildIhdrBody,
  buildValidScreenshotPng,
  pngChunk,
  pngChunkWithBadCrc,
} from "./parity-history-png-fixture.mjs";

const IHDR = buildIhdrBody();
const IEND = Buffer.alloc(0);
const IDAT = deflateSync(Buffer.from([0, 0x20, 0x40, 0x60]));

assert.equal(pngCrc32(Buffer.from("123456789")), 0xcbf43926);
assert.equal(hasValidPngStructure(buildValidScreenshotPng()), true);

assert.equal(valid([pngChunk("IHDR", IHDR), pngChunk("IEND", IEND)]), false);
assert.equal(
  valid([
    pngChunk("IHDR", IHDR),
    pngChunk("IHDR", IHDR),
    pngChunk("IDAT", IDAT),
    pngChunk("IEND", IEND),
  ]),
  false,
);

const zeroWidth = Buffer.from(IHDR);
zeroWidth.writeUInt32BE(0, 0);
assert.equal(
  valid([
    pngChunk("IHDR", zeroWidth),
    pngChunk("IDAT", IDAT),
    pngChunk("IEND", IEND),
  ]),
  false,
);
assert.equal(
  valid([
    pngChunk("IHDR", IHDR),
    pngChunk("IDAT", Buffer.from("not-zlib")),
    pngChunk("IEND", IEND),
  ]),
  false,
);
assert.equal(
  valid([
    pngChunk("IHDR", IHDR),
    pngChunkWithBadCrc("IDAT", IDAT),
    pngChunk("IEND", IEND),
  ]),
  false,
);
assert.equal(
  valid([
    pngChunk("IHDR", IHDR),
    pngChunk("IDAT", IDAT),
    pngChunkWithBadCrc("IEND", IEND),
  ]),
  false,
);

const truncatedIdat = pngChunk("IDAT", IDAT).subarray(0, 10);
assert.equal(valid([pngChunk("IHDR", IHDR), truncatedIdat]), false);

process.stdout.write("history png decoding self-test passed\n");

function valid(chunks) {
  return hasValidPngStructure(Buffer.concat([PNG_SIGNATURE, ...chunks]));
}
