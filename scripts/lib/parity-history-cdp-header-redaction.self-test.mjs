#!/usr/bin/env node
import assert from "node:assert/strict";
import { sanitizeCdpText } from "./parity-history-cdp-redaction.mjs";

const cases = [
  {
    input: "Authorization: Bearer A.B.C\nordinary next line",
    secrets: ["A.B.C"],
    preserved: ["ordinary next line"],
  },
  {
    input: "Authorization: Basic base64==\r\nAccept: text/plain",
    secrets: ["base64=="],
    preserved: ["Accept: text/plain"],
  },
  {
    input: "Authorization: Digest username=u, response=F543-DIGEST",
    secrets: ["username=u", "F543-DIGEST"],
  },
  {
    input: "Authorization: Negotiate F543-NEGOTIATE continuation",
    secrets: ["F543-NEGOTIATE", "continuation"],
  },
  {
    input: "Authorization: Custom F543-CUSTOM secret with spaces",
    secrets: ["F543-CUSTOM", "secret with spaces"],
  },
  {
    input:
      "Proxy-Authorization: AWS4-HMAC Credential=F543-PROXY, Signature=F543-SIGNATURE",
    secrets: ["F543-PROXY", "F543-SIGNATURE"],
  },
  {
    input: "authorization='Custom quoted F543-QUOTE with spaces'",
    secrets: ["F543-QUOTE", "with spaces"],
  },
  {
    input:
      "request headers { Authorization: Custom F543-INLINE with spaces; Accept: text/plain }",
    secrets: ["F543-INLINE", "with spaces"],
    preserved: ["Accept: text/plain"],
  },
  {
    input: "request headers { Proxy-Authorization=F543-NOSCHEME; Accept: */* }",
    secrets: ["F543-NOSCHEME"],
    preserved: ["Accept: */*"],
  },
  {
    input:
      "request headers { Cookie: sid=F543-SID; csrf=F543-CSRF; ordinary=yes }",
    secrets: ["F543-SID", "F543-CSRF", "ordinary=yes"],
  },
  {
    input:
      "request headers { Set-Cookie: sid=F543-SET; Expires=Wed, 09 Jun 2027 10:18:14 GMT; HttpOnly; Accept: safe }",
    secrets: ["F543-SET", "Expires=", "HttpOnly"],
    preserved: ["Accept: safe"],
  },
  {
    input: '{"cookie":"sid=F543-JSON; csrf=F543-JSON-CSRF","safe":"visible"}',
    secrets: ["F543-JSON", "F543-JSON-CSRF"],
    preserved: ['"safe":"visible"'],
  },
  {
    input:
      '{"authorization":"Custom F543-ESCAPED \\"quoted\\" tail","safe":"visible"}',
    secrets: ["F543-ESCAPED", "quoted", "tail"],
    preserved: ['"safe":"visible"'],
  },
];

for (const { input, secrets, preserved = [] } of cases) {
  const sanitized = sanitizeCdpText(input);
  for (const secret of secrets)
    assert.doesNotMatch(sanitized, new RegExp(secret));
  for (const marker of preserved)
    assert.match(sanitized, new RegExp(escape(marker)));
  assert.equal(sanitizeCdpText(sanitized), sanitized);
  assert.doesNotMatch(sanitized, /\[REDACTED\]\]/);
  assert.equal(markerCount(sanitized), 1, input);
}

const multiple = sanitizeCdpText(
  "Authorization: Custom F543-A\nCookie: sid=F543-B; csrf=F543-C\nvisible",
);
assert.equal(markerCount(multiple), 2);
assert.match(multiple, /visible/);
for (const safe of [
  "authorizationError: visible",
  "CookieMonster: visible",
  "cookieConsent=visible",
]) {
  assert.equal(sanitizeCdpText(safe), safe);
}
assert.equal(
  sanitizeCdpText("Authorization: [REDACTED]"),
  "Authorization: [REDACTED]",
);

process.stdout.write("history CDP header redaction self-test passed\n");

function markerCount(value) {
  return value.split("[REDACTED]").length - 1;
}

function escape(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
