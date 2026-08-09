#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, realpath, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { artifactMetadata } from "./parity-history-browser-artifacts.mjs";
import { persistHistoryBrowserEvidence } from "./parity-history-browser-evidence-persistence.mjs";
import {
  CDP_EVIDENCE_SCHEMA,
  CDP_EVIDENCE_VERSION,
} from "./parity-history-cdp-capture.mjs";
import { cdpSessionFixture } from "./parity-history-cdp-session.fixture.mjs";

const runRoot = await mkdtemp(
  join(await realpath(tmpdir()), "f637-browser-evidence-"),
);
const outputDirectory = join(runRoot, "f456");
await mkdir(outputDirectory);
const proof = Buffer.from("validated browser evidence proof");
const session = {
  outputNames: ["proof.txt"],
  artifacts: { "proof.txt": artifactMetadata("text", proof) },
  contents: { "proof.txt": proof },
  cdpEvidence: {
    schema: CDP_EVIDENCE_SCHEMA,
    version: CDP_EVIDENCE_VERSION,
    session: cdpSessionFixture(),
    actions: [{ index: 0, type: "text", artifact: "proof.txt" }],
    console: [],
    httpResponses: [
      {
        requestId: "document-1",
        url: "http://localhost:4131/projects/proof",
        host: "localhost:4131",
        type: "Document",
        status: 200,
      },
    ],
    failedRequests: [],
    runtimeExceptions: [],
  },
};

try {
  const receipt = await persistHistoryBrowserEvidence({
    runRoot,
    outputDirectory,
    session,
  });
  assert.equal(receipt.status, "persisted");
  assert.equal(
    await readFile(receipt.artifacts["proof.txt"].path, "utf8"),
    proof.toString(),
  );
  assert.deepEqual(
    JSON.parse(await readFile(receipt.cdp.path, "utf8")),
    session.cdpEvidence,
  );
  assert.equal((await stat(receipt.receiptPath)).mode & 0o777, 0o600);
  assert.equal((await stat(receipt.evidenceDirectory)).mode & 0o777, 0o700);
  await assert.rejects(
    persistHistoryBrowserEvidence({ runRoot, outputDirectory, session }),
    /EEXIST/,
  );
  assert.deepEqual(
    await persistHistoryBrowserEvidence({
      outputDirectory,
      session,
    }),
    { status: "not_requested" },
  );
  await assert.rejects(
    persistHistoryBrowserEvidence({
      runRoot,
      outputDirectory: runRoot,
      session,
    }),
    /output-scope/,
  );
} finally {
  await rm(runRoot, { recursive: true, force: true });
}

const producer = await readFile(
  new URL("../parity-version-history-e2e.mjs", import.meta.url),
  "utf8",
);
assert.match(
  producer,
  /realpath\(process\.env\[HISTORY_CHAIN_RUN_ROOT\] \|\| tmpdir\(\)\)/,
);
assert.match(producer, /await persistHistoryBrowserEvidence\(\{/);

process.stdout.write("history browser evidence persistence self-test passed\n");
