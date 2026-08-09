#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { waitForHistoryStackReadiness } from "./parity-history-stack-readiness.mjs";

const urls = {
  apiHealthUrl: "http://127.0.0.1:4101/health",
  webUrl: "http://127.0.0.1:4102/",
  targetUrl: "http://127.0.0.1:4103/",
};
let round = 0;
const receipt = await waitForHistoryStackReadiness({
  ...urls,
  attempts: 2,
  delayMs: 0,
  sleep: async () => {
    round += 1;
  },
  fetchImpl: async (url) => {
    if (round === 0 && url.includes(":4102")) throw new Error("not ready");
    return new Response(
      url.includes(":4103") ? "Parity Target Workload" : "ok",
      { status: 200 },
    );
  },
});
assert.equal(receipt.status, "ready");
assert.equal(receipt.attempt, 2);
assert.equal(round, 1);

await assert.rejects(
  waitForHistoryStackReadiness({
    ...urls,
    attempts: 1,
    delayMs: 0,
    fetchImpl: async () => new Response("wrong target", { status: 200 }),
  }),
  /attempts-exhausted/,
);
await assert.rejects(
  waitForHistoryStackReadiness({
    ...urls,
    webUrl: "https://example.com/",
  }),
  /origin/,
);

const producer = await readFile(
  new URL("../parity-version-history-e2e.mjs", import.meta.url),
  "utf8",
);
const initialWait = producer.indexOf("await waitStackReady();");
const preflight = producer.indexOf('step("preflight"');
assert.ok(initialWait >= 0 && initialWait < preflight);
assert.match(producer, /targetUrl: `\$\{runtime\.targetOrigin\}\/`/);
process.stdout.write("history complete stack readiness self-test passed\n");
