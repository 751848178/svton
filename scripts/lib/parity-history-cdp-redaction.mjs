import {
  cdpHeaderValueSpans,
  redactCdpValueSpans,
} from "./parity-history-cdp-header-redaction.mjs";

const MAX_CAPTURE_LENGTH = 4_000;
// Compound credential keys may be written with any of space, dot, hyphen or
// underscore between words (e.g. `api key`, `api.key`, `x-api-key`, `api_key`).
// Newlines are deliberately excluded so a key cannot match across lines. The
// separator is zero-or-more to also keep no-separator forms (e.g. `apikey`).
const KEY_SEPARATOR = String.raw`[-_. \t]*`;
const COOKIE_KEY_SOURCE = String.raw`(?:cookie|set[-_]?cookie)`;
const CREDENTIAL_KEY_SOURCE = String.raw`(?:authorization|proxy[-_]?authorization|${COOKIE_KEY_SOURCE}|session(?:${KEY_SEPARATOR}id)?|x${KEY_SEPARATOR}api${KEY_SEPARATOR}key|api${KEY_SEPARATOR}key|access${KEY_SEPARATOR}key|signature|credentials?|[a-z0-9_-]*(?:token|password|secret)[a-z0-9_-]*)`;
const CREDENTIAL_KEY = new RegExp(`^${CREDENTIAL_KEY_SOURCE}$`, "i");
const CREDENTIAL_KEY_VALUE = new RegExp(
  `(["']?\\b${CREDENTIAL_KEY_SOURCE}\\b["']?\\s*[:=]\\s*)("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|[^\\r\\n,;}\\]]+)`,
  "gi",
);

export function sanitizeCdpText(value) {
  if (typeof value !== "string") return value;
  const spans = [
    ...cdpHeaderValueSpans(value),
    ...genericCredentialValueSpans(value),
  ];
  return redactCdpValueSpans(value, spans).slice(0, MAX_CAPTURE_LENGTH);
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

function genericCredentialValueSpans(value) {
  return [...value.matchAll(CREDENTIAL_KEY_VALUE)].map((match) => {
    const start = match.index + match[1].length;
    const markerEnd = start + "[REDACTED]".length;
    const end = value.startsWith("[REDACTED]", start)
      ? markerEnd
      : start + match[2].length;
    return { start, end };
  });
}
