import assert from "node:assert/strict";
import { resolve } from "node:path";
import { materializeParityHistoryArtifacts } from "./parity-seed-version-history-artifacts.mjs";

const ids = {
  project: "project-1",
  orderPrev: "order-1",
  buildPrevA: "build-a",
  buildPrevB: "build-b",
};

const calls = [];
const compose = async (args) => calls.push(args);
const root = resolve(import.meta.dirname, "../..");
const first = await materializeParityHistoryArtifacts(root, compose, ids);
const second = await materializeParityHistoryArtifacts(root, compose, ids);

assert.equal(first.length, 2);
assert.match(first[0], /^sha256:[a-f0-9]{64}$/);
assert.notEqual(first[0], first[1]);
assert.deepEqual(first, second);
assert.equal(calls.filter((args) => args[0] === "cp").length, 4);
assert.ok(calls.every((args) => !args.join(" ").includes("..")));
await assert.rejects(
  materializeParityHistoryArtifacts(root, compose, {
    ...ids,
    project: "../unsafe",
  }),
  /identity is unsafe/,
);

process.stdout.write("parity seed version history artifact self-test passed\n");
