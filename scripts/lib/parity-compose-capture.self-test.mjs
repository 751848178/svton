import assert from "node:assert/strict";
import { createParityComposeCapture } from "./parity-compose-capture.mjs";
import { parityRuntimeConfig } from "./parity-runtime-config.mjs";

const runtime = parityRuntimeConfig({
  PARITY_COMPOSE_PROJECT: "devpilot-parity-capture",
});
let invocation;
const capture = createParityComposeCapture("/repo", runtime, (...args) => {
  invocation = args;
  return { status: 0, stdout: "proof", stderr: "" };
});
assert.deepEqual(capture(["logs", "api"]), {
  status: 0,
  stdout: "proof",
  stderr: "",
});
assert.deepEqual(invocation[1].slice(0, 6), [
  "compose",
  "-p",
  "devpilot-parity-capture",
  "-f",
  "/repo/docker-compose.devpilot-parity.yml",
  "logs",
]);
assert.equal(
  invocation[2].env.PARITY_COMPOSE_PROJECT,
  "devpilot-parity-capture",
);

console.log("parity compose capture self-test passed");
