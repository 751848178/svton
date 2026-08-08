#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { HISTORY_RESULT_KEY_INVENTORY } from "./parity-negative-history-result-key-inventory.mjs";

const src = await readFile(
  new URL("../parity-version-history-e2e.mjs", import.meta.url),
  "utf8",
);
const projection = await readFile(
  new URL("./parity-negative-history-confirm-result.mjs", import.meta.url),
  "utf8",
);
const inv = HISTORY_RESULT_KEY_INVENTORY;
const steps = Object.keys(inv).filter(
  (name) =>
    ![
      "browser-pass",
      "production-confirm",
      "production-recovery-confirm",
    ].includes(name),
);
for (const step of steps) {
  assert.deepEqual(stepKeys(src, step), inv[step], step);
}
for (const step of ["production-confirm", "production-recovery-confirm"]) {
  const requestKeys = [
    "expectedInputHash",
    "expectedManifestDigest",
    "expectedManifestId",
  ];
  if (step === "production-recovery-confirm")
    requestKeys.push("sourceVersionId");
  assert.deepEqual(confirmKeys(src, step), requestKeys, `${step}:request`);
  const literal = projKeys(projection);
  const expected =
    step === "production-recovery-confirm"
      ? [...literal, ...projAssign(projection)]
      : literal;
  assert.deepEqual(expected.sort(), inv[step], `${step}:projection`);
}
assert.deepEqual(browserKeys(src), inv["browser-pass"], "browser-pass");
assert.notDeepEqual(
  [...inv["browser-pass"], "junk"].sort(),
  inv["browser-pass"],
);

process.stdout.write("negative history result key producer self-test passed\n");

function stepRegion(source, name) {
  const start = source.indexOf(`step("${name}",`);
  assert.ok(start >= 0, `step not found: ${name}`);
  const next = source.indexOf('step("', start + 1);
  return source.slice(start, next < 0 ? source.length : next);
}

function stepKeys(source, name) {
  const region = stepRegion(source, name);
  const returnAt = region.lastIndexOf("return {");
  assert.ok(returnAt >= 0, `return object not found: ${name}`);
  return objectKeys(region, returnAt + 7).sort();
}

function confirmKeys(source, name) {
  const region = stepRegion(source, name);
  assert.ok(
    region.includes("productionConfirmResult("),
    `confirm call not found: ${name}`,
  );
  return objectKeys(region, region.lastIndexOf("{")).sort();
}

function projKeys(source) {
  const start = source.indexOf("const result = {");
  assert.ok(start >= 0, "projection result literal not found");
  return objectKeys(source, start + "const result = ".length).sort();
}

function projAssign(source) {
  return [...source.matchAll(/result\.([A-Za-z0-9_$]+)\s*=/g)]
    .map((match) => match[1])
    .sort();
}

function browserKeys(source) {
  const start = source.indexOf("async function browserPass(");
  assert.ok(start >= 0, "browserPass not found");
  const returnAt = source.indexOf("return {", start);
  assert.ok(returnAt >= 0, "browser return object not found");
  return objectKeys(source, returnAt + 7).sort();
}

function objectKeys(source, i) {
  const keys = [];
  let depth = 0;
  let group = 0;
  let start = true;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '"' || ch === "'") {
      const end = skipQuoted(source, i, ch);
      if (depth === 1 && group === 0 && start) {
        let j = end;
        while (/\s/.test(source[j] ?? "")) j++;
        if (source[j] === ":") {
          keys.push(source.slice(i + 1, end - 1));
          start = false;
          i = j;
        }
      } else {
        start = false;
      }
      i = end;
      continue;
    }
    if (ch === "`") {
      i = skipQuoted(source, i, ch);
      start = false;
      continue;
    }
    if (ch === "(" || ch === "[") {
      group++;
      start = false;
      i++;
      continue;
    }
    if (ch === ")" || ch === "]") {
      group--;
      i++;
      continue;
    }
    if (ch === "{") {
      depth++;
      if (depth === 1) start = true;
      i++;
      continue;
    }
    if (ch === "}") {
      depth--;
      if (depth === 0) return keys;
      start = false;
      i++;
      continue;
    }
    if (depth === 1 && group === 0) {
      if (/[A-Za-z0-9_$]/.test(ch)) {
        let j = i;
        while (j < source.length && /[A-Za-z0-9_$]/.test(source[j])) j++;
        let k = j;
        while (/\s/.test(source[k] ?? "")) k++;
        const isKey =
          start &&
          (source[k] === ":" || source[k] === "," || source[k] === "}");
        if (isKey) keys.push(source.slice(i, j));
        start = false;
        i = isKey ? k : j;
        continue;
      }
      if (ch === ",") {
        start = true;
        i++;
        continue;
      }
    }
    i++;
  }
  throw new Error("unbalanced object literal");
}

function skipQuoted(source, i, quote) {
  i++;
  while (i < source.length) {
    if (source[i] === "\\") {
      i += 2;
      continue;
    }
    if (source[i] === quote) return i + 1;
    i++;
  }
  return i;
}
