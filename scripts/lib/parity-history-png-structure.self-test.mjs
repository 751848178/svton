#!/usr/bin/env node
// Focused self-test for the PNG structural validator (parity-history-png-structure).
// Covers every acceptance/rejection rule for F534-v2, including the standalone
// reproduction that a stream without a terminating IEND is rejected.
import assert from "node:assert/strict";
import { hasValidPngStructure } from "./parity-history-png-structure.mjs";
import {
  PNG_SIGNATURE,
  buildIhdrBody,
  buildPngWithoutIend,
  buildValidScreenshotPng,
  pngChunk,
  pngChunkWithBadCrc,
} from "./parity-history-png-fixture.mjs";

const IHDR = buildIhdrBody();
const IEND = Buffer.alloc(0);

// A real minimal PNG (and one with intermediate chunks) must be accepted.
assert.equal(hasValidPngStructure(buildValidScreenshotPng()), true);

// Signature + padding is no longer enough; the structure must parse.
assert.equal(
  hasValidPngStructure(Buffer.concat([PNG_SIGNATURE, Buffer.alloc(120, 1)])),
  false,
);

// Malformed: signature + garbage chunk stream.
assert.equal(
  hasValidPngStructure(
    Buffer.concat([
      PNG_SIGNATURE,
      Buffer.from("not-a-real-chunk-stream".repeat(8)),
    ]),
  ),
  false,
);

// Truncated chunk header (signature + partial IHDR length field).
assert.equal(
  hasValidPngStructure(
    Buffer.concat([
      PNG_SIGNATURE,
      Buffer.from([0, 0, 0]),
      Buffer.alloc(120, 0),
    ]),
  ),
  false,
);

// IHDR with a wrong CRC.
assert.equal(
  hasValidPngStructure(
    Buffer.concat([
      PNG_SIGNATURE,
      pngChunkWithBadCrc("IHDR", IHDR),
      Buffer.alloc(8),
    ]),
  ),
  false,
);

// IHDR is not the first chunk (a tEXt precedes it) -> rejected.
assert.equal(
  hasValidPngStructure(
    Buffer.concat([
      PNG_SIGNATURE,
      pngChunk("tEXt", Buffer.from("x")),
      pngChunk("IHDR", IHDR),
      pngChunk("IEND", IEND),
    ]),
  ),
  false,
);

// Only IHDR, no IEND -> rejected.
assert.equal(
  hasValidPngStructure(Buffer.concat([PNG_SIGNATURE, pngChunk("IHDR", IHDR)])),
  false,
);

// IHDR + legal intermediate chunk, no IEND -> rejected.
assert.equal(
  hasValidPngStructure(
    Buffer.concat([
      PNG_SIGNATURE,
      pngChunk("IHDR", IHDR),
      pngChunk("tEXt", Buffer.from("Comment\0payload")),
    ]),
  ),
  false,
);

// IEND with a non-zero body length -> rejected.
assert.equal(
  hasValidPngStructure(
    Buffer.concat([
      PNG_SIGNATURE,
      pngChunk("IHDR", IHDR),
      pngChunk("IEND", Buffer.from("x")),
    ]),
  ),
  false,
);

// IEND present but trailing bytes follow -> rejected.
assert.equal(
  hasValidPngStructure(
    Buffer.concat([
      PNG_SIGNATURE,
      pngChunk("IHDR", IHDR),
      pngChunk("IEND", IEND),
      Buffer.from("trailing"),
    ]),
  ),
  false,
);

// Out-of-range chunk length (declared length overflows the buffer) -> rejected.
assert.equal(
  hasValidPngStructure(
    Buffer.concat([
      PNG_SIGNATURE,
      Buffer.from([0xff, 0xff, 0xff, 0xff]),
      Buffer.from("tEXt"),
    ]),
  ),
  false,
);

// THE F534 REJECTION REPRO: signature + valid IHDR + 255 valid tEXt chunks, no
// IEND (3348 bytes). The rejected validator accepted this; it must be rejected.
const noIend = buildPngWithoutIend(255);
assert.equal(noIend.length, 3348);
assert.equal(hasValidPngStructure(noIend), false);

// Non-buffer input is rejected.
assert.equal(hasValidPngStructure(null), false);
assert.equal(hasValidPngStructure("not-a-buffer"), false);

process.stdout.write("history png structure self-test passed\n");
