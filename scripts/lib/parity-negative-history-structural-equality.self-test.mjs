#!/usr/bin/env node
import assert from "node:assert/strict";
import { validateTrustedHistoryBase } from "./parity-negative-history-base-identity.mjs";
import { historyDocumentFixture } from "./parity-negative-history-contract-fixture.mjs";
import { structuralEqual } from "./parity-negative-history-structural-equality.mjs";

const snapshot = {
  domains: ["production.example.test"],
  proxyTarget: "http://target-workload",
  tlsRequired: true,
};

assert.equal(
  structuralEqual(snapshot, {
    tlsRequired: true,
    proxyTarget: "http://target-workload",
    domains: ["production.example.test"],
  }),
  true,
);

assert.equal(
  structuralEqual(
    { outer: { a: 1, b: { x: [1, 2], y: "z" } }, flag: true },
    { flag: true, outer: { b: { y: "z", x: [1, 2] }, a: 1 } },
  ),
  true,
);

assert.equal(
  structuralEqual(
    { domains: ["a.example.test", "b.example.test"] },
    { domains: ["b.example.test", "a.example.test"] },
  ),
  false,
);

assert.equal(structuralEqual({ a: 1, b: 2 }, { a: 1 }), false);
assert.equal(structuralEqual({ a: 1 }, { a: 1, b: 2 }), false);

assert.equal(structuralEqual({ n: 5 }, { n: "5" }), false);
assert.equal(structuralEqual({ n: true }, { n: 1 }), false);

assert.equal(structuralEqual(null, null), true);
assert.equal(structuralEqual(null, {}), false);
assert.equal(structuralEqual(null, []), false);
assert.equal(structuralEqual({}, []), false);
assert.equal(structuralEqual([1, 2], [1, 2, 3]), false);

const document = historyDocumentFixture();
const base = document.steps["base-state-rows"];
base.result.expected.productionRouteSnapshot = reorderedSnapshot(
  document.context.productionRouteSnapshot,
);
const anchors = validateTrustedHistoryBase(base, document.context);
assert.equal(anchors.buildRunId, document.context.buildRunId);

const swapped = historyDocumentFixture();
const swappedBase = swapped.steps["base-state-rows"];
swapped.context.productionRouteSnapshot = {
  ...swapped.context.productionRouteSnapshot,
  domains: ["a.example.test", "b.example.test"],
};
swappedBase.result.expected.productionRouteSnapshot = {
  ...swapped.context.productionRouteSnapshot,
  domains: ["b.example.test", "a.example.test"],
};
assert.throws(
  () => validateTrustedHistoryBase(swappedBase, swapped.context),
  undefined,
  "array reorder",
);

const missing = historyDocumentFixture();
const missingBase = missing.steps["base-state-rows"];
missingBase.result.expected.productionRouteSnapshot = {
  ...missing.context.productionRouteSnapshot,
};
delete missingBase.result.expected.productionRouteSnapshot.proxyTarget;
assert.throws(
  () => validateTrustedHistoryBase(missingBase, missing.context),
  undefined,
  "missing route key",
);

process.stdout.write("negative history structural equality self-test passed\n");

function reorderedSnapshot(snapshotValue) {
  const entries = Object.entries(snapshotValue);
  const reversed = entries.reverse();
  return Object.fromEntries(reversed);
}
