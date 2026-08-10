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

// F545: spaced and dotted credential key forms must hit (space/dot/hyphen/underscore).
const separatorKeyCredentials = [
  ["api key: F545-API-SPACE-01", "F545-API-SPACE-01"],
  ["api.key: F545-API-DOT-02", "F545-API-DOT-02"],
  ["x api key = F545-X-SPACE-03", "F545-X-SPACE-03"],
  ["x.api.key: F545-X-DOT-04", "F545-X-DOT-04"],
  ["access key: F545-ACCESS-SPACE-05", "F545-ACCESS-SPACE-05"],
  ["access.key=F545-ACCESS-DOT-06", "F545-ACCESS-DOT-06"],
  ["session id: F545-SESSION-SPACE-07", "F545-SESSION-SPACE-07"],
  ["session.id = F545-SESSION-DOT-08", "F545-SESSION-DOT-08"],
];
for (const [text, secret] of separatorKeyCredentials) {
  const sanitized = sanitizeCdpText(text);
  assert.equal(sanitized.includes(secret), false, text);
  assert.equal(sanitizeCdpText(sanitized), sanitized);
}
// Compound keys with a newline between words must NOT match (single-line separator).
const crossLine = sanitizeCdpText("api\nkey: F545-CROSSLINE-NOPE");
assert.match(crossLine, /F545-CROSSLINE-NOPE/);

// F546: bounded marker keys still redact; ordinary marker-substring words do not.
const boundedRedactKeys = [
  "token",
  "password",
  "secret",
  "access_token",
  "client_secret",
  "apisecret",
  "sessiontoken",
  "tokenv2",
  "accesstoken",
  "refreshtoken",
];
for (const key of boundedRedactKeys) {
  const sanitized = sanitizeCdpText(`${key}: F546-LEAK`);
  assert.equal(sanitized.includes("F546-LEAK"), false, key);
}
const boundedSafeKeys = [
  "tokenizer",
  "secretary",
  "passwordless",
  "tokenize",
  "secretly",
  "secrets",
  "tokener",
];
for (const key of boundedSafeKeys) {
  const sanitized = sanitizeCdpText(`${key}: F546-VISIBLE`);
  assert.match(sanitized, /F546-VISIBLE/, key);
}

const queryKeys = [
  "session",
  "sessionid",
  "api_key",
  "api-key",
  "x-api-key",
  "access_key",
  "signature",
  "credential",
  // F545: dot-separated compound query keys must also hit.
  "api.key",
  "x.api.key",
  "access.key",
  "session.id",
];
for (const [index, key] of queryKeys.entries()) {
  const secret = `F539-QUERY-${index}`;
  const sanitized = sanitizeCdpUrl(
    `https://example.test/callback?${key}=${secret}&safe=yes`,
  );
  assert.equal(sanitized.includes(secret), false, key);
  assert.match(sanitized, /safe=yes/);
}
// F546: ordinary marker-substring query keys must keep their value visible.
for (const key of ["tokenizer", "secretary", "passwordless", "tokenize"]) {
  const sanitized = sanitizeCdpUrl(
    `https://example.test/callback?${key}=F546-QUERY-VISIBLE&safe=yes`,
  );
  assert.match(sanitized, /F546-QUERY-VISIBLE/, key);
  assert.match(sanitized, /safe=yes/);
}

const fragmentSecret = "F539-FRAGMENT-11";
const fragmentUrl = sanitizeCdpUrl(
  `https://example.test/#api_key=${fragmentSecret}&route=history`,
);
assert.equal(fragmentUrl.includes(fragmentSecret), false);
assert.equal(fragmentUrl.includes("route=history"), false);
assert.equal(
  sanitizeCdpUrl("https://example.test/#opaque-fragment-secret").includes(
    "opaque-fragment-secret",
  ),
  false,
);
const credentialUrl = sanitizeCdpUrl(
  "https://F539-USER-12:F539-PASS-13@example.test/?view=history",
);
assert.equal(credentialUrl.includes("F539-USER-12"), false);
assert.equal(credentialUrl.includes("F539-PASS-13"), false);
assert.match(credentialUrl, /view=history/);

const sanitizedEvents = capture([
  exception("Authorization: Custom F544-EXCEPTION-SECRET", {
    url: "https://example.test/error?token=F544-EXCEPTION-URL&safe=yes",
    description: "Cookie: sid=F544-DESCRIPTION-SECRET",
  }),
  {
    method: "Runtime.consoleAPICalled",
    params: {
      type: "error",
      args: [
        { value: "Cookie: sid=F544-CONSOLE-SECRET" },
        {
          value: { authorization: "F544-OBJECT-SECRET" },
          description: "Authorization: Custom F544-CONSOLE-DESCRIPTION",
          preview: { description: "F544-PREVIEW-SECRET" },
        },
      ],
    },
  },
  {
    method: "Log.entryAdded",
    params: {
      entry: {
        level: "error",
        text: "Set-Cookie: sid=F544-LOG-SECRET",
        url: "https://example.test/log?token=F544-LOG-URL&safe=yes",
      },
    },
  },
  {
    method: "Network.requestWillBeSent",
    params: {
      requestId: "failed-secret",
      type: "Fetch",
      request: {
        url: "https://bob:pw@failed.example.test/?token=F544-FAILED-URL",
      },
    },
  },
  {
    method: "Network.responseReceived",
    params: {
      requestId: "response-secret",
      type: "Fetch",
      response: {
        url: "https://alice:pass@api.example.test/?token=F544-RESPONSE-URL&safe=yes",
        status: 200,
      },
    },
  },
  {
    method: "Network.loadingFailed",
    params: {
      requestId: "failed-secret",
      type: "Fetch",
      errorText: "Authorization: Custom F544-FAILED-ERROR",
    },
  },
]);
const eventReport = JSON.stringify(sanitizedEvents);
assert.doesNotMatch(eventReport, /F544-|alice|bob|pass@|pw@/);
assert.deepEqual(sanitizedEvents.console[0].args, [
  "Cookie: [REDACTED]",
  "Authorization: [REDACTED]",
]);
assert.match(sanitizedEvents.console[1].url, /safe=yes/);
assert.equal(sanitizedEvents.httpResponses[0].host, "api.example.test");
assert.match(sanitizedEvents.httpResponses[0].url, /safe=yes/);
assert.equal(sanitizedEvents.failedRequests[0].host, "failed.example.test");

const ordinaryText = "ReferenceError: ordinary boom at app.js:1";
const ordinaryException = capture([exception(ordinaryText)]);
assert.equal(ordinaryException.runtimeExceptions[0].text, ordinaryText);

const longException = capture([exception("x".repeat(5_000))]);
assert.equal(longException.runtimeExceptions[0].text.length, 4_000);
assert.doesNotThrow(() => JSON.stringify(longException));

for (const [key, sentinel] of [
  ["code", "OAUTH-SENTINEL"],
  ["X-Amz-Signature", "AWS-SENTINEL"],
  ["key", "GENERIC-SENTINEL"],
  ["X-Goog-Credential", "GOOGLE-SENTINEL"],
  ["sig", "AZURE-SENTINEL"],
]) {
  const sanitized = sanitizeCdpUrl(
    `https://signed.example.test/path?${key}=${sentinel}&safe=yes`,
  );
  assert.doesNotMatch(sanitized, new RegExp(sentinel));
  assert.match(sanitized, /%5BREDACTED%5D/);
  assert.match(sanitized, /safe=yes/);
}

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
