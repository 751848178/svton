#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ARTIFACT_MIN_BYTES,
  artifactMetadata,
  browserArtifactsValid,
  readBackBrowserArtifacts,
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
const browserOut = await mkdtemp(join(tmpdir(), "f533-artifacts-"));
const entries = Object.entries(names).map(([kind, name]) => ({
  [kind]: `${browserOut}/${name}`,
  ...valid[name],
}));
const files = Object.fromEntries(
  Object.entries(names).map(([kind, name]) => [
    `${browserOut}/${name}`,
    buffers[kind],
  ]),
);
await writeFixtures();
const snapshot = await readBackBrowserArtifacts(entries, browserOut);
assert.deepEqual(snapshot.artifacts, valid);
for (const [kind, name] of Object.entries(names)) {
  assert.deepEqual(snapshot.contents[name], buffers[kind]);
}
await writeFile(`${browserOut}/proof.txt`, Buffer.from("changed-path-content"));
assert.deepEqual(snapshot.contents["proof.txt"], buffers.text);
assert.equal(
  artifactMetadata("text", snapshot.contents["proof.txt"]).sha256,
  snapshot.artifacts["proof.txt"].sha256,
);
await rejectsReadback((reported) => {
  reported[0].sha256 = "0".repeat(64);
});
await rejectsReadback((reported) => {
  reported[0].bytes += 1;
});
await rejectsReadback((reported) => {
  reported[0].kind = "text";
});
await rejectsReadback(
  () => {},
  async () => {
    await writeFile(`${browserOut}/proof.txt`, Buffer.alloc(0));
  },
);
await rejectsReadback(
  () => {},
  async () => {
    await writeFile(
      `${browserOut}/proof.html`,
      Buffer.alloc(ARTIFACT_MIN_BYTES.dom - 1),
    );
  },
);
await rejectsReadback(
  () => {},
  async () => {
    await writeFile(
      `${browserOut}/proof.png`,
      Buffer.alloc(ARTIFACT_MIN_BYTES.screenshot, 1),
    );
  },
);
await rejectsReadback((reported) => {
  reported[0].screenshot = "/tmp/outside/proof.png";
});
await rejectsReadback((reported) => {
  reported.push(structuredClone(reported[0]));
});
await writeFile(`${browserOut}/wrong.txt`, buffers.screenshot);
await assert.rejects(
  () =>
    readBackBrowserArtifacts(
      [{ screenshot: `${browserOut}/wrong.txt`, ...valid["proof.png"] }],
      browserOut,
    ),
  /E2E_ARTIFACT_READBACK_INVALID/,
);
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
const driver = await readFile(
  new URL("../parity-version-history-e2e.mjs", import.meta.url),
  "utf8",
);
assert.match(driver, /const \{ artifacts, contents \}/);
assert.match(driver, /contents\["02-release-detail\.txt"\]/);
assert.doesNotMatch(
  driver,
  /readFile\(`\$\{browserOut\}\/0(?:2-release-detail|2b-staging-step|3-build-log-drawer|4-staging-run-log|5-production-recovery-log|6-env-versions)\.txt/,
);
await rm(browserOut, { recursive: true });

process.stdout.write("history browser artifact self-test passed\n");

function rejects(name, mutate) {
  const metadata = structuredClone(valid);
  mutate(metadata);
  assert.equal(browserArtifactsValid(required, metadata), false, name);
}

async function rejectsReadback(mutate, changeFile = async () => {}) {
  await writeFixtures();
  const reported = structuredClone(entries);
  mutate(reported);
  await changeFile();
  await assert.rejects(
    () => readBackBrowserArtifacts(reported, browserOut),
    /E2E_(?:ARTIFACT_(?:READBACK|CONTENT)|BROWSER_FILE)_INVALID/,
  );
}

async function writeFixtures() {
  await Promise.all(
    Object.entries(files).map(([path, buffer]) => writeFile(path, buffer)),
  );
}
