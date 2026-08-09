#!/usr/bin/env node
import assert from "node:assert/strict";
import { buildRuntimeImagesSequentially } from "./parity-runtime-image-build.mjs";

const images = {
  api: "api-image",
  web: "web-image",
  "route-control": "route-image",
  "deploy-target": "deploy-image",
  "target-workload": "target-image",
};
const order = [];
let active = 0;
let maximum = 0;
const services = await buildRuntimeImagesSequentially(
  images,
  async (service) => {
    active += 1;
    maximum = Math.max(maximum, active);
    await Promise.resolve();
    order.push(service);
    active -= 1;
  },
);
assert.deepEqual(order, Object.keys(images));
assert.deepEqual(services, Object.keys(images));
assert.equal(maximum, 1);
await assert.rejects(
  buildRuntimeImagesSequentially({ api: "only" }, async () => {}),
  /service-inventory/,
);
process.stdout.write("runtime image sequential build self-test passed\n");
