import assert from "node:assert/strict";
import { createParitySeedRuntimeOperations } from "./parity-seed-runtime-operations.mjs";

const inspected = [];
const compose = (args) => ({
  stdout: args[0] === "ps" ? `${args.at(-1)}-container\n` : "",
});
const run = (_executable, args) => {
  inspected.push(args[1]);
  return { stdout: "healthy\n" };
};
const operations = createParitySeedRuntimeOperations({
  compose,
  run,
  dbName: "db",
  dbUrl: "mysql://local/db",
});

await operations.waitDeployTargetHealthy();
await operations.waitTargetWorkloadHealthy();

assert.deepEqual(inspected, [
  "deploy-target-container",
  "target-workload-container",
]);
console.log("parity seed runtime dependency self-test passed");
