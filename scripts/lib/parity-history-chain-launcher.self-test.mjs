#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { openHistoryChainArtifact } from "./parity-history-chain-artifact.mjs";
import { runHistoryChain } from "./parity-history-chain-launcher.mjs";
import { negativeHistoryInputFromEnvironment } from "./parity-negative-e2e-context.mjs";
import {
  assertPublicHistoryChainInvocation,
  createHistoryChainPaths,
  HISTORY_CHAIN_RUN_ROOT,
  LEGACY_HISTORY_INPUTS,
} from "./parity-history-chain-paths.mjs";
import { NODE_CODE_INJECTION_ENV } from "./parity-trusted-node-environment.mjs";
import { readHistoryChainReceipt } from "./parity-history-chain-receipt-reader.mjs";

assert.throws(
  () => assertPublicHistoryChainInvocation(["caller-path"], {}),
  /accepts no arguments/,
);
for (const name of [...LEGACY_HISTORY_INPUTS, HISTORY_CHAIN_RUN_ROOT]) {
  assert.throws(
    () => assertPublicHistoryChainInvocation([], { [name]: "forged" }),
    new RegExp(name),
  );
}
for (const name of NODE_CODE_INJECTION_ENV) {
  assert.throws(
    () => assertPublicHistoryChainInvocation([], { [name]: "injected" }),
    new RegExp(name),
  );
}
assert.throws(() => negativeHistoryInputFromEnvironment({}), /marker missing/);
assert.throws(
  () =>
    negativeHistoryInputFromEnvironment({
      DEVPILOT_HISTORY_CHAIN_CONSUMER: "1",
      F456_EVIDENCE_SHA256: "a".repeat(64),
    }),
  /legacy history input forbidden/,
);
const directEnvironment = { ...process.env };
delete directEnvironment.DEVPILOT_HISTORY_CHAIN_CONSUMER;
delete directEnvironment.DEVPILOT_HISTORY_CHAIN_CHILD;
delete directEnvironment.DEVPILOT_HISTORY_CHAIN_RUN_ROOT;
for (const name of LEGACY_HISTORY_INPUTS) delete directEnvironment[name];
const directConsumer = spawnSync(
  process.execPath,
  [new URL("../parity-negative-e2e.mjs", import.meta.url).pathname],
  { env: directEnvironment, encoding: "utf8" },
);
assert.notEqual(directConsumer.status, 0);
assert.match(
  directConsumer.stderr,
  /trusted history chain consumer marker missing/,
);

const calls = [];
let successfulRunRoot;
const ownedParent = await realpath(
  await mkdtemp(join(await realpath(tmpdir()), "f537-owned-parent-")),
);
const result = await runHistoryChain({
  args: [],
  env: {},
  parentDirectory: ownedParent,
  spawn(_command, args, options) {
    calls.push(args[0]);
    const runRoot = options.env.DEVPILOT_HISTORY_CHAIN_RUN_ROOT;
    if (args[0] === "scripts/parity-version-history-e2e.mjs") {
      successfulRunRoot = runRoot;
      writeProducerFixtures(runRoot);
      return { status: 0, pid: 5001 };
    }
    assert.equal(args[0], "scripts/parity-negative-e2e.mjs");
    assert.equal(options.env.DEVPILOT_HISTORY_CHAIN_CONSUMER, "1");
    for (const name of LEGACY_HISTORY_INPUTS)
      assert.equal(options.env[name], undefined);
    const trusted = readHistoryChainReceipt({
      evidenceFd: options.stdio[3],
      receiptFd: options.stdio[4],
      parentPid: process.pid,
      expectedRunRoot: runRoot,
    });
    assert.equal(JSON.parse(trusted.bytes).status, "passed");
    assert.throws(
      () =>
        readHistoryChainReceipt({
          evidenceFd: options.stdio[3],
          receiptFd: options.stdio[4],
          parentPid: process.pid,
          expectedRunRoot: runRoot,
          nowMs: Date.parse(trusted.receipt.consumerDeadlineAt) + 1,
        }),
      /consumer-observation-delayed/,
    );
    return { status: 0, pid: 5002 };
  },
});
assert.deepEqual(calls, [
  "scripts/parity-version-history-e2e.mjs",
  "scripts/parity-negative-e2e.mjs",
]);
assert.equal(result.status, "passed");
assert.deepEqual(result.finalProductionIdentity, {
  releaseRunId: "release-recovery-1",
  deploymentRunId: "deployment-recovery-1",
  environmentVersionId: "version-recovery-1",
});
assert.equal(dirname(successfulRunRoot), ownedParent);
await rm(ownedParent, { recursive: true, force: true });

await staleArtifactRejects();
await symlinkArtifactRejects();
await symlinkAncestorRejects();
await mutationArtifactRejects();
await staticCallGraphChecks();

process.stdout.write("F537 trusted history chain launcher self-test passed\n");

function writeProducerFixtures(runRoot) {
  const capturedAt = new Date().toISOString();
  const f455Directory = join(runRoot, "f455");
  const f456Directory = join(runRoot, "f456");
  mkdirSync(f455Directory, { recursive: true });
  mkdirSync(f456Directory, { recursive: true });
  const f455Path = join(f455Directory, "f455-positive-e2e-evidence.json");
  const f455 = Buffer.from(JSON.stringify({ status: "passed", capturedAt }));
  writeFileSync(f455Path, f455);
  const sha256 = createHash("sha256").update(f455).digest("hex");
  writeFileSync(
    join(f456Directory, "f456-version-history-evidence.json"),
    JSON.stringify({
      status: "passed",
      capturedAt,
      context: { sourceEvidenceSha256: sha256 },
      steps: {
        "base-f455-chain-rerun": {
          result: { sourceEvidence: f455Path, sourceEvidenceSha256: sha256 },
        },
        "production-recovery-execute": {
          status: "passed",
          verified: true,
          result: {
            status: "completed",
            releaseRunId: "release-recovery-1",
            expectedReleaseRunId: "release-recovery-1",
            deploymentRunId: "deployment-recovery-1",
            newEnvironmentVersion: {
              id: "version-recovery-1",
              kind: "recovery",
              deploymentRunId: "deployment-recovery-1",
            },
          },
        },
      },
    }),
  );
}

async function staleArtifactRejects() {
  const paths = await createHistoryChainPaths();
  try {
    await mkdir(paths.f456Directory, { recursive: true });
    await writeFile(
      paths.f456Evidence,
      JSON.stringify({
        status: "passed",
        capturedAt: "2020-01-01T00:00:00.000Z",
      }),
    );
    const old = new Date("2020-01-01T00:00:00.000Z");
    await utimes(paths.f456Evidence, old, old);
    await assert.rejects(
      openHistoryChainArtifact({
        path: paths.f456Evidence,
        runRoot: paths.runRoot,
        producerStartedAtMs: Date.now() - 100,
        producerEndedAtMs: Date.now(),
      }),
      /stale/,
    );
  } finally {
    await rm(paths.runRoot, { recursive: true, force: true });
  }
}

async function symlinkArtifactRejects() {
  const paths = await createHistoryChainPaths();
  try {
    await mkdir(paths.f456Directory, { recursive: true });
    const target = join(paths.runRoot, "target.json");
    await writeFile(
      target,
      JSON.stringify({
        status: "passed",
        capturedAt: new Date().toISOString(),
      }),
    );
    await symlink(target, paths.f456Evidence);
    await assert.rejects(
      openHistoryChainArtifact({
        path: paths.f456Evidence,
        runRoot: paths.runRoot,
        producerStartedAtMs: Date.now() - 100,
        producerEndedAtMs: Date.now(),
      }),
      /path-not-regular/,
    );
  } finally {
    await rm(paths.runRoot, { recursive: true, force: true });
  }
}

async function symlinkAncestorRejects() {
  const paths = await createHistoryChainPaths();
  try {
    const actualDirectory = join(paths.runRoot, "actual-f456");
    await mkdir(actualDirectory, { recursive: true });
    await writeFile(
      join(actualDirectory, "f456-version-history-evidence.json"),
      JSON.stringify({
        status: "passed",
        capturedAt: new Date().toISOString(),
      }),
    );
    await symlink(actualDirectory, paths.f456Directory);
    await assert.rejects(
      openHistoryChainArtifact({
        path: paths.f456Evidence,
        runRoot: paths.runRoot,
        producerStartedAtMs: Date.now() - 100,
        producerEndedAtMs: Date.now(),
      }),
      /symlink-ancestor/,
    );
  } finally {
    await rm(paths.runRoot, { recursive: true, force: true });
  }
}

async function mutationArtifactRejects() {
  const paths = await createHistoryChainPaths();
  try {
    await mkdir(paths.f456Directory, { recursive: true });
    await writeFile(
      paths.f456Evidence,
      JSON.stringify({
        status: "passed",
        capturedAt: new Date().toISOString(),
      }),
    );
    await assert.rejects(
      openHistoryChainArtifact({
        path: paths.f456Evidence,
        runRoot: paths.runRoot,
        producerStartedAtMs: Date.now() - 100,
        producerEndedAtMs: Date.now(),
        afterOpen: () => writeFile(paths.f456Evidence, "changed"),
      }),
      /changed-during-read|path-replaced-during-read/,
    );
  } finally {
    await rm(paths.runRoot, { recursive: true, force: true });
  }
}

async function staticCallGraphChecks() {
  const launcher = await readFile(
    new URL("./parity-history-chain-launcher.mjs", import.meta.url),
    "utf8",
  );
  const producer = await readFile(
    new URL("../parity-version-history-e2e.mjs", import.meta.url),
    "utf8",
  );
  const consumer = await readFile(
    new URL("../parity-negative-e2e.mjs", import.meta.url),
    "utf8",
  );
  assert.equal(
    (launcher.match(/parity-version-history-e2e\.mjs/g) || []).length,
    1,
  );
  assert.doesNotMatch(launcher, /parity-positive-e2e\.mjs/);
  assert.equal(
    (producer.match(/runNode\(\["scripts\/parity-positive-e2e\.mjs"\]/g) || [])
      .length,
    1,
  );
  for (const name of LEGACY_HISTORY_INPUTS)
    assert.doesNotMatch(consumer, new RegExp(name));
}
