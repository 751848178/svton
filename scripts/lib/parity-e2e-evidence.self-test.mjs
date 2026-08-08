#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  check,
  checkedStep,
  deriveAcceptance,
  finishEvidence,
  predicate,
} from "./parity-e2e-evidence.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const selfPath = fileURLToPath(import.meta.url);

async function rejectsFalsePayload() {
  const evidence = freshEvidence();
  await assert.rejects(
    checkedStep(evidence, "false-payload", async () => ({ ok: false }),
      (result) => [check("ok", result.ok, true)]),
    hasAssertionCode,
  );
  assert.equal(evidence.status, "failed");
  assert.equal(evidence.steps["false-payload"].checks[0].pass, false);
  const child = spawnSync(process.execPath, [selfPath, "--false-fixture"], {
    encoding: "utf8",
  });
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /E2E_ASSERTION_FAILED false-fixture: ok/);
}

async function permitsExpectedFalse() {
  const evidence = freshEvidence();
  await checkedStep(evidence, "expected-false", async () => ({ decisionAllowed: false }),
    (result) => [check("decisionAllowed", result.decisionAllowed, false)]);
  assert.equal(evidence.steps["expected-false"].ok, true);
}

function rejectsInvalidAcceptanceSources() {
  for (const steps of [
    {},
    { target: { ok: false, status: "failed", verified: true, checks: [{ name: "x", pass: true }] } },
    { target: { ok: true, status: "passed", verified: true, checks: [] } },
  ]) {
    const evidence = { status: "running", steps, ac: {} };
    assert.throws(() => deriveAcceptance(evidence, { AC: ["target"] }), hasAssertionCode);
    assert.equal(evidence.status, "failed");
  }
}

async function finishNeverMasksFailure() {
  const evidence = freshEvidence();
  await assert.rejects(
    checkedStep(evidence, "target", async () => ({ ready: false }),
      (result) => [predicate("ready", result.ready, result.ready)]),
    hasAssertionCode,
  );
  assert.throws(() => finishEvidence(evidence, { AC: ["target"] }), hasAssertionCode);
  assert.equal(evidence.status, "failed");
}

async function guardsHardcodedAcceptance() {
  const names = [
    "parity-positive-e2e.mjs",
    "parity-version-history-e2e.mjs",
    "parity-negative-e2e.mjs",
  ];
  const sources = await Promise.all(names.map(async (name) => ({
    name,
    source: await readFile(resolve(root, "scripts", name), "utf8"),
  })));
  const offenders = sources.filter(({ source }) => hardcodedAcceptance(source));
  assert.deepEqual(offenders.map(({ name }) => name).sort(), [
    "parity-negative-e2e.mjs",
    "parity-version-history-e2e.mjs",
  ]);
  assert.equal(hardcodedAcceptance(sources[0].source), false);
}

function hardcodedAcceptance(source) {
  return /["']AC-E2E-\d+["']\s*:\s*\{\s*ok\s*:\s*true/.test(source);
}

function freshEvidence() {
  return { status: "running", steps: {}, ac: {} };
}

function hasAssertionCode(error) {
  return error?.code === "E2E_ASSERTION_FAILED";
}

if (process.argv.includes("--false-fixture")) {
  const evidence = freshEvidence();
  await checkedStep(evidence, "false-fixture", async () => ({ ok: false }),
    (result) => [check("ok", result.ok, true)]);
} else {
  await rejectsFalsePayload();
  await permitsExpectedFalse();
  rejectsInvalidAcceptanceSources();
  await finishNeverMasksFailure();
  await guardsHardcodedAcceptance();
  process.stdout.write("parity-e2e-evidence self-test passed\n");
}
