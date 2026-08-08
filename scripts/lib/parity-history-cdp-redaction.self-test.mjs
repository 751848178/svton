#!/usr/bin/env node
import assert from "node:assert/strict";
import { createCdpCapture } from "./parity-history-cdp-capture.mjs";
import {
  sanitizeCdpText,
  sanitizeCdpUrl,
} from "./parity-history-cdp-redaction.mjs";

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

const textCredentials = [
  ["Cookie: session=F539-COOKIE-01\nordinary-cookie-text", "F539-COOKIE-01"],
  [
    "Set-Cookie: sessionid=F539-SET-COOKIE-02; Path=/\nordinary-set-cookie-text",
    "F539-SET-COOKIE-02",
  ],
  ["SESSION = F539-SESSION-03", "F539-SESSION-03"],
  ["session_id: F539-SESSION-ID-04", "F539-SESSION-ID-04"],
  ['{"api_key":"F539-API-KEY-05","safe":"visible"}', "F539-API-KEY-05"],
  ["api-key=F539-API-DASH-06", "F539-API-DASH-06"],
  ["X-API-Key: F539-X-API-07", "F539-X-API-07"],
  ["access_key = F539-ACCESS-08", "F539-ACCESS-08"],
  ["SIGNATURE: F539-SIGNATURE-09", "F539-SIGNATURE-09"],
  ['"credential": "F539-CREDENTIAL-10"', "F539-CREDENTIAL-10"],
];
for (const [text, secret] of textCredentials) {
  const sanitized = sanitizeCdpText(text);
  assert.equal(sanitized.includes(secret), false, text);
}
assert.match(sanitizeCdpText(textCredentials[0][0]), /ordinary-cookie-text/);
assert.match(sanitizeCdpText(textCredentials[4][0]), /"safe":"visible"/);

const queryKeys = [
  "session",
  "sessionid",
  "api_key",
  "api-key",
  "x-api-key",
  "access_key",
  "signature",
  "credential",
];
for (const [index, key] of queryKeys.entries()) {
  const secret = `F539-QUERY-${index}`;
  const sanitized = sanitizeCdpUrl(
    `https://example.test/callback?${key}=${secret}&safe=yes`,
  );
  assert.equal(sanitized.includes(secret), false, key);
  assert.match(sanitized, /safe=yes/);
}

const fragmentSecret = "F539-FRAGMENT-11";
const fragmentUrl = sanitizeCdpUrl(
  `https://example.test/#api_key=${fragmentSecret}&route=history`,
);
assert.equal(fragmentUrl.includes(fragmentSecret), false);
assert.match(fragmentUrl, /route=history/);
const credentialUrl = sanitizeCdpUrl(
  "https://F539-USER-12:F539-PASS-13@example.test/?view=history",
);
assert.equal(credentialUrl.includes("F539-USER-12"), false);
assert.equal(credentialUrl.includes("F539-PASS-13"), false);
assert.match(credentialUrl, /view=history/);

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
