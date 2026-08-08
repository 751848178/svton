#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCdpActions } from "./parity-history-cdp-actions.mjs";

const outputDirectory = await mkdtemp(join(tmpdir(), "f547-actions-"));
const password = "F547-EXECUTION-SECRET@@@tail";
const navigation =
  "https://alice:pw@example.test/reset/opaque?token=F547-NAV-EXECUTION#fragment";
const actions = [
  "wait:25",
  `navigate:${navigation}`,
  `setValue:input[type=password]@@@${password}`,
  "click:button[type=submit]",
  "waitText:Welcome: account",
  "shot:proof.png",
  "text:proof.txt",
  "dom:proof.html",
];
const calls = [];
const cdp = fakeCdp(calls, true);
const output = await captureStdout(() =>
  runCdpActions(
    cdp,
    actions,
    { out: outputDirectory, width: 1200, height: 800 },
    { sleep: async () => {} },
  ),
);
assert.deepEqual(
  calls.map(({ method }) => method),
  [
    "Emulation.setDeviceMetricsOverride",
    "Page.navigate",
    "Runtime.evaluate",
    "Runtime.evaluate",
    "Runtime.evaluate",
    "Page.captureScreenshot",
    "Runtime.evaluate",
    "Runtime.evaluate",
  ],
);
assert.equal(calls[1].params.url, navigation);
assert.match(calls[2].params.expression, /F547-EXECUTION-SECRET@@@tail/);
assert.doesNotMatch(output, /F547-EXECUTION-SECRET|F547-NAV-EXECUTION/);
const receipts = output
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));
assert.equal(receipts.length, 3);
assert.deepEqual(
  receipts.map(({ kind }) => kind),
  ["screenshot", "text", "dom"],
);
assert.equal((await readFile(join(outputDirectory, "proof.png"))).length, 128);
assert.match(
  await readFile(join(outputDirectory, "proof.txt"), "utf8"),
  /visible text/,
);
assert.match(
  await readFile(join(outputDirectory, "proof.html"), "utf8"),
  /document/,
);

const failureSecret = "F547-FAILURE-SECRET";
const failureOutput = await captureStdout(async () => {
  await assert.rejects(
    runCdpActions(
      fakeCdp([], false),
      [`setValue:input[type=password]@@@${failureSecret}`],
      { out: outputDirectory, width: 1, height: 1 },
      { sleep: async () => {} },
    ),
    (error) => {
      assert.equal(error.message, "E2E_CDP_ACTION_FAILED:0:setValue");
      assert.doesNotMatch(String(error), new RegExp(failureSecret));
      return true;
    },
  );
});
assert.doesNotMatch(failureOutput, new RegExp(failureSecret));
await rm(outputDirectory, { recursive: true });

process.stdout.write("history CDP actions self-test passed\n");

function fakeCdp(calls, setValuePass) {
  return {
    async call(method, params = {}) {
      calls.push({ method, params });
      if (method === "Page.captureScreenshot") {
        return { data: pngFixture().toString("base64") };
      }
      if (method !== "Runtime.evaluate") return {};
      if (params.expression.includes("outerHTML")) {
        return { result: { value: `<html>${"document".repeat(12)}</html>` } };
      }
      if (params.expression.includes("innerText :")) {
        return { result: { value: "visible text fixture" } };
      }
      if (params.expression.includes("HTMLInputElement")) {
        return { result: { value: setValuePass } };
      }
      return { result: { value: true } };
    },
  };
}

function pngFixture() {
  const buffer = Buffer.alloc(128);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer);
  return buffer;
}

async function captureStdout(action) {
  const originalWrite = process.stdout.write;
  let output = "";
  process.stdout.write = (chunk) => {
    output += String(chunk);
    return true;
  };
  try {
    await action();
    return output;
  } finally {
    process.stdout.write = originalWrite;
  }
}
