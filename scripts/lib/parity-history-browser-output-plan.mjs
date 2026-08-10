import { basename } from "node:path";

const NONCE = /^[a-f0-9]{64}$/;

export function encodeBrowserOutputPlan(runNonce, names) {
  validateNonce(runNonce);
  validateNames(names);
  const value = {
    version: 1,
    runNonce,
    outputs: names.map((name, index) => ({ name, fd: index + 3 })),
  };
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function decodeBrowserOutputPlan(encoded) {
  requireValue(typeof encoded === "string" && encoded.length > 0, "encoded");
  let value;
  try {
    value = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw planError("decode");
  }
  requireKeys(value, ["version", "runNonce", "outputs"]);
  requireValue(value.version === 1, "version");
  validateNonce(value.runNonce);
  requireValue(
    Array.isArray(value.outputs) && value.outputs.length > 0,
    "outputs",
  );
  const names = [];
  const fds = [];
  for (const [index, entry] of value.outputs.entries()) {
    requireKeys(entry, ["name", "fd"]);
    requireValue(validName(entry.name), "name");
    requireValue(entry.fd === index + 3, "fd");
    names.push(entry.name);
    fds.push(entry.fd);
  }
  validateNames(names);
  return Object.freeze({
    runNonce: value.runNonce,
    outputs: Object.freeze(
      Object.fromEntries(names.map((name, index) => [name, fds[index]])),
    ),
  });
}

function validateNonce(value) {
  requireValue(typeof value === "string" && NONCE.test(value), "nonce");
}

function validateNames(names) {
  requireValue(Array.isArray(names) && names.length > 0, "names");
  requireValue(names.every(validName), "name");
  requireValue(new Set(names).size === names.length, "duplicate-name");
}

function validName(name) {
  return typeof name === "string" && basename(name) === name && name.length > 0;
}

function requireKeys(value, expected) {
  requireValue(
    value && typeof value === "object" && !Array.isArray(value),
    "object",
  );
  const keys = Object.keys(value);
  requireValue(
    keys.length === expected.length &&
      expected.every((key) => Object.hasOwn(value, key)),
    "keys",
  );
}

function requireValue(value, reason) {
  if (!value) throw planError(reason);
}

function planError(reason) {
  return new Error(`E2E_BROWSER_OUTPUT_PLAN_INVALID:${reason}`);
}
