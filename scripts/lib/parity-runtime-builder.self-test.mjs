#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  assertNoOwnedBuildxBuilder,
  createOwnedBuildxBuilder,
  destroyOwnedBuildxBuilder,
} from "./parity-runtime-builder.mjs";

const runtime = {
  runtimeId: "c5-a1b2c3d4-1234abcd",
  builderName: "devpilot-builder-c5-a1b2c3d4-1234abcd",
};
const shared = builder("shared-builder", "docker-container");
const state = [shared];
const calls = [];
const execute = (args) => {
  calls.push(args);
  if (args[0] === "buildx" && args[1] === "ls") {
    return {
      status: 0,
      stdout: state.map((item) => JSON.stringify(item)).join("\n"),
    };
  }
  if (args[0] === "buildx" && args[1] === "create") {
    state.push(builder(runtime.builderName, "docker-container"));
    return { status: 0, stdout: runtime.builderName };
  }
  if (args[0] === "buildx" && args[1] === "rm") {
    state.splice(
      state.findIndex((item) => item.Name === runtime.builderName),
      1,
    );
    return { status: 0, stdout: runtime.builderName };
  }
  return { status: 1, stderr: "unexpected command" };
};

assert.equal(createOwnedBuildxBuilder(runtime, execute).status, "verified");
assert.equal(state.length, 2);
assert.equal(destroyOwnedBuildxBuilder(runtime, execute).status, "removed");
assert.deepEqual(state, [shared]);
assert.equal(
  assertNoOwnedBuildxBuilder(runtime, execute).status,
  "verified_absent",
);
assert(calls.some((args) => args.includes("default-load=true")));

state.push(builder(runtime.builderName, "docker"));
assert.throws(
  () => destroyOwnedBuildxBuilder(runtime, execute),
  /identity-mismatch/,
);
assert.equal(state.length, 2);

process.stdout.write("parity owned Buildx builder self-test passed\n");

function builder(name, driver) {
  return {
    Name: name,
    Driver: driver,
    Nodes: [{ Name: `${name}0`, Status: "running" }],
  };
}
