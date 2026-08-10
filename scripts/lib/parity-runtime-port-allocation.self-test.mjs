import assert from "node:assert/strict";
import { allocateDistinctLoopbackPorts } from "./parity-runtime-port-allocation.mjs";

const ports = await allocateDistinctLoopbackPorts(6);
assert.equal(ports.length, 6);
assert.equal(new Set(ports).size, 6);
assert.equal(
  ports.every((port) => port >= 1024 && port <= 65535),
  true,
);
for (const invalid of [0, 33, 1.5]) {
  await assert.rejects(allocateDistinctLoopbackPorts(invalid), /count/);
}

console.log("parity runtime port allocation self-test passed");
