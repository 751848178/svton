#!/usr/bin/env node
// Focused self-test for F534-v2 browser artifact content validation. This
// locks the end-to-end rejection rules through artifactMetadata (the public
// entry in parity-history-browser-artifacts): a screenshot must be a complete
// PNG, DOM must be valid UTF-8 with an HTML signal, and text must be valid
// UTF-8 with printable content. The pure PNG-structure rules are covered by
// parity-history-png-structure.self-test.mjs.
import assert from "node:assert/strict";
import {
  ARTIFACT_MIN_BYTES,
  artifactMetadata,
} from "./parity-history-browser-artifacts.mjs";
import {
  PNG_SIGNATURE,
  buildPngWithoutIend,
  buildValidScreenshotPng,
} from "./parity-history-png-fixture.mjs";

// Valid artifacts of every kind remain accepted.
assert.doesNotThrow(() =>
  artifactMetadata("screenshot", buildValidScreenshotPng()),
);
assert.doesNotThrow(() =>
  artifactMetadata(
    "dom",
    Buffer.from(`<!doctype html><html>${"d".repeat(64)}</html>`),
  ),
);
assert.doesNotThrow(() =>
  artifactMetadata("text", Buffer.from("t".repeat(ARTIFACT_MIN_BYTES.text))),
);

// Screenshot: signature + padding is no longer enough; structure must parse.
assert.throws(
  () =>
    artifactMetadata(
      "screenshot",
      Buffer.concat([
        PNG_SIGNATURE,
        Buffer.alloc(ARTIFACT_MIN_BYTES.screenshot - PNG_SIGNATURE.length, 1),
      ]),
    ),
  /E2E_ARTIFACT_CONTENT_INVALID/,
);

// Screenshot: IHDR + legal intermediate chunks but no IEND must be rejected.
assert.throws(
  () => artifactMetadata("screenshot", buildPngWithoutIend(8)),
  /E2E_ARTIFACT_CONTENT_INVALID/,
);

// DOM: empty, NUL padding, and non-UTF-8 are rejected.
assert.throws(
  () => artifactMetadata("dom", Buffer.alloc(0)),
  /E2E_ARTIFACT_CONTENT_INVALID/,
);
assert.throws(
  () => artifactMetadata("dom", Buffer.alloc(ARTIFACT_MIN_BYTES.dom + 8, 0)),
  /E2E_ARTIFACT_CONTENT_INVALID/,
);
assert.throws(
  () =>
    artifactMetadata(
      "dom",
      Buffer.concat([
        Buffer.from("<html>"),
        Buffer.from([0xff, 0xfe, 0xfd]),
        Buffer.alloc(ARTIFACT_MIN_BYTES.dom, 0x41),
      ]),
    ),
  /E2E_ARTIFACT_CONTENT_INVALID/,
);

// Text: empty, NUL padding, and non-UTF-8 are rejected.
assert.throws(
  () => artifactMetadata("text", Buffer.alloc(0)),
  /E2E_ARTIFACT_CONTENT_INVALID/,
);
assert.throws(
  () => artifactMetadata("text", Buffer.alloc(ARTIFACT_MIN_BYTES.text + 8, 0)),
  /E2E_ARTIFACT_CONTENT_INVALID/,
);
assert.throws(
  () =>
    artifactMetadata(
      "text",
      Buffer.concat([
        Buffer.from("ok"),
        Buffer.from([0xff, 0xfe, 0xfd]),
        Buffer.alloc(ARTIFACT_MIN_BYTES.text, 0x41),
      ]),
    ),
  /E2E_ARTIFACT_CONTENT_INVALID/,
);

// Wrong type is rejected.
assert.throws(
  () => artifactMetadata("unknown", Buffer.alloc(ARTIFACT_MIN_BYTES.text + 1)),
  /E2E_ARTIFACT_CONTENT_INVALID/,
);

process.stdout.write("history artifact content self-test passed\n");
