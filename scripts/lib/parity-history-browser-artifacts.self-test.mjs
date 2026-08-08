#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  ARTIFACT_MIN_BYTES,
  artifactMetadata,
  browserArtifactsValid,
} from "./parity-history-browser-artifacts.mjs";

const buffers = {
  screenshot: Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(ARTIFACT_MIN_BYTES.screenshot - 8, 1),
  ]),
  dom: Buffer.from(
    `<!doctype html><html><body>${"d".repeat(64)}</body></html>`,
  ),
  text: Buffer.from("t".repeat(ARTIFACT_MIN_BYTES.text)),
};
const names = {
  screenshot: "proof.png",
  dom: "proof.html",
  text: "proof.txt",
};
const required = Object.values(names);
const valid = Object.fromEntries(
  Object.entries(names).map(([kind, name]) => [
    name,
    artifactMetadata(kind, buffers[kind]),
  ]),
);

assert.equal(browserArtifactsValid(required, valid), true);
for (const [kind, name] of Object.entries(names)) {
  assert.throws(
    () => artifactMetadata(kind, Buffer.alloc(0)),
    /E2E_ARTIFACT_CONTENT_INVALID/,
  );
  assert.throws(
    () => artifactMetadata(kind, Buffer.alloc(ARTIFACT_MIN_BYTES[kind] - 1)),
    /E2E_ARTIFACT_CONTENT_INVALID/,
  );
  rejects(name, (metadata) => {
    delete metadata[name];
  });
  rejects(name, (metadata) => {
    metadata[name] = {};
  });
  rejects(name, (metadata) => {
    metadata[name].bytes = 0;
  });
  rejects(name, (metadata) => {
    metadata[name].bytes = ARTIFACT_MIN_BYTES[kind] - 1;
  });
  rejects(name, (metadata) => {
    metadata[name].kind = kind === "text" ? "dom" : "text";
  });
  rejects(name, (metadata) => {
    metadata[name].sha256 = "invalid";
  });
}
assert.throws(
  () =>
    artifactMetadata(
      "screenshot",
      Buffer.alloc(ARTIFACT_MIN_BYTES.screenshot, 1),
    ),
  /E2E_ARTIFACT_CONTENT_INVALID/,
);

process.stdout.write("history browser artifact self-test passed\n");

function rejects(name, mutate) {
  const metadata = structuredClone(valid);
  mutate(metadata);
  assert.equal(browserArtifactsValid(required, metadata), false, name);
}
