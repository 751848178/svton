const MAX_CAPTURE_LENGTH = 4_000;
const COOKIE_KEY_SOURCE = String.raw`(?:cookie|set[-_]?cookie)`;
const CREDENTIAL_KEY_SOURCE = String.raw`(?:authorization|proxy[-_]?authorization|${COOKIE_KEY_SOURCE}|session(?:[-_]?id)?|x[-_]?api[-_]?key|api[-_]?key|access[-_]?key|signature|credentials?|[a-z0-9_-]*(?:token|password|secret)[a-z0-9_-]*)`;
const CREDENTIAL_KEY = new RegExp(`^${CREDENTIAL_KEY_SOURCE}$`, "i");
const COOKIE_HEADER = new RegExp(
  `(^|[\\r\\n])([ \\t]*${COOKIE_KEY_SOURCE}\\s*:\\s*)[^\\r\\n]*`,
  "gim",
);
const AUTHORIZATION_VALUE =
  /(["']?\bauthorization\b["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|(?:bearer|basic)\s+[^\s,;}\]]+|[^\s,;}\]]+)/gi;
const AUTH_SCHEME_VALUE = /\b(?:bearer|basic)\s+[^\s,;}\]]+/gi;
const CREDENTIAL_KEY_VALUE = new RegExp(
  `(["']?\\b${CREDENTIAL_KEY_SOURCE}\\b["']?\\s*[:=]\\s*)(?:"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|[^\\r\\n,;}\\]]+)`,
  "gi",
);

export function sanitizeCdpText(value) {
  if (typeof value !== "string") return value;
  return value
    .replace(COOKIE_HEADER, "$1$2[REDACTED]")
    .replace(AUTHORIZATION_VALUE, "$1[REDACTED]")
    .replace(AUTH_SCHEME_VALUE, "[REDACTED]")
    .replace(CREDENTIAL_KEY_VALUE, "$1[REDACTED]")
    .slice(0, MAX_CAPTURE_LENGTH);
}

export function sanitizeCdpUrl(value) {
  if (typeof value !== "string") return value;
  try {
    const url = new URL(value);
    if (url.username) url.username = "[REDACTED]";
    if (url.password) url.password = "[REDACTED]";
    for (const key of new Set(url.searchParams.keys())) {
      if (credentialKey(key)) {
        url.searchParams.set(key, "[REDACTED]");
      }
    }
    redactFragment(url);
    return url.toString().slice(0, MAX_CAPTURE_LENGTH);
  } catch {
    return sanitizeCdpText(value);
  }
}

function redactFragment(url) {
  if (url.hash) url.hash = "[REDACTED]";
}

function credentialKey(value) {
  return CREDENTIAL_KEY.test(value);
}
