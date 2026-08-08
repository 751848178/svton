const MAX_CAPTURE_LENGTH = 4_000;
const AUTHORIZATION_VALUE =
  /(["']?\bauthorization\b["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|(?:bearer|basic)\s+[^\s,;}\]]+|[^\s,;}\]]+)/gi;
const AUTH_SCHEME_VALUE = /\b(?:bearer|basic)\s+[^\s,;}\]]+/gi;
const SENSITIVE_KEY_VALUE =
  /(["']?\b[a-z0-9_-]*(?:token|password|secret)[a-z0-9_-]*\b["']?\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\r\n,;}\]]+)/gi;
const SENSITIVE_URL_KEY = /(?:token|authorization|password|secret)/i;

export function sanitizeCdpText(value) {
  if (typeof value !== "string") return value;
  return value
    .replace(AUTHORIZATION_VALUE, "$1[REDACTED]")
    .replace(AUTH_SCHEME_VALUE, "[REDACTED]")
    .replace(SENSITIVE_KEY_VALUE, "$1[REDACTED]")
    .slice(0, MAX_CAPTURE_LENGTH);
}

export function sanitizeCdpUrl(value) {
  if (typeof value !== "string") return value;
  try {
    const url = new URL(value);
    if (url.username) url.username = "[REDACTED]";
    if (url.password) url.password = "[REDACTED]";
    for (const key of url.searchParams.keys()) {
      if (SENSITIVE_URL_KEY.test(key)) {
        url.searchParams.set(key, "[REDACTED]");
      }
    }
    if (url.hash) url.hash = "[REDACTED]";
    return url.toString().slice(0, MAX_CAPTURE_LENGTH);
  } catch {
    return sanitizeCdpText(value);
  }
}
