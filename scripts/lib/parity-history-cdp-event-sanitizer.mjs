import {
  sanitizeCdpText,
  sanitizeCdpUrl,
} from "./parity-history-cdp-redaction.mjs";

const SAFE_CONSOLE_TYPES = new Set([
  "object",
  "function",
  "undefined",
  "symbol",
  "bigint",
  "string",
  "number",
  "boolean",
]);

export function sanitizeConsoleArg(arg) {
  if (arg === null || typeof arg === "number" || typeof arg === "boolean") {
    return arg;
  }
  if (typeof arg === "string") return sanitizeCdpText(arg);
  if (!isPlainObject(arg)) return "[CDP:unknown]";
  const value = arg.value;
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "string") return sanitizeCdpText(value);
  const description = sanitizeOptionalText(arg.description);
  if (typeof description === "string" && description.length > 0) {
    return description;
  }
  const type = SAFE_CONSOLE_TYPES.has(arg.type) ? arg.type : "unknown";
  return `[CDP:${type}]`;
}

export function sanitizeOptionalText(value) {
  if (value === null || value === undefined) return value;
  return typeof value === "string" ? sanitizeCdpText(value) : undefined;
}

export function sanitizeUrlWithHost(value) {
  if (value === null || value === undefined) {
    return Object.freeze({ url: value, host: null });
  }
  if (typeof value !== "string") {
    return Object.freeze({ url: undefined, host: null });
  }
  const url = sanitizeCdpUrl(value);
  let host = null;
  try {
    host = new URL(url).host;
  } catch {
    host = null;
  }
  return Object.freeze({ url, host });
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
