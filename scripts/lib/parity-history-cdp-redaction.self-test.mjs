#!/usr/bin/env node
import assert from "node:assert/strict";
import { createCdpCapture } from "./parity-history-cdp-capture.mjs";

const redactedException = capture([
  exception(
    'Authorization: Bearer abc.def; authorization = Basic dXNlcjpwYXNz; TOKEN="two word token"; "PASSWORD": "p a s s"; client_secret=alpha beta',
    {
      url: "https://alice:pass@localhost:4131/app?ToKeN=query-secret&safe=yes#access_token=fragment-secret",
      description: "Refresh-Token: gamma.delta; ordinary-marker",
    },
  ),
]);
const report = JSON.stringify(redactedException);
for (const secret of [
  "abc.def",
  "dXNlcjpwYXNz",
  "two word token",
  "p a s s",
  "alpha beta",
  "gamma.delta",
  "alice",
  "pass@",
  "query-secret",
  "fragment-secret",
]) {
  assert.equal(report.includes(secret), false, secret);
}
assert.match(report, /ordinary-marker/);
assert.match(redactedException.runtimeExceptions[0].url, /safe=yes/);

const ordinaryText = "ReferenceError: ordinary boom at app.js:1";
const ordinaryException = capture([exception(ordinaryText)]);
assert.equal(ordinaryException.runtimeExceptions[0].text, ordinaryText);

const longException = capture([exception("x".repeat(5_000))]);
assert.equal(longException.runtimeExceptions[0].text.length, 4_000);
assert.doesNotThrow(() => JSON.stringify(longException));

process.stdout.write("history CDP redaction self-test passed\n");

function capture(events) {
  const collector = createCdpCapture();
  events.forEach(collector.record);
  return collector.snapshot();
}

function exception(text, options = {}) {
  return {
    method: "Runtime.exceptionThrown",
    params: {
      exceptionDetails: {
        text,
        url: options.url,
        exception: options.description
          ? { description: options.description }
          : undefined,
      },
    },
  };
}
