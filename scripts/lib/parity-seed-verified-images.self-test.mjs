import assert from "node:assert/strict";
import { verifiedImagesForSeedCommand } from "./parity-seed-verified-images.mjs";

const runtime = { runtimeId: "runtime-1" };
const imageIds = { api: "sha256:api" };

for (const command of ["up", "reset"]) {
  let builds = 0;
  const result = await verifiedImagesForSeedCommand({
    command,
    runtime,
    build: async () => {
      builds += 1;
      return imageIds;
    },
  });
  assert.equal(result, imageIds);
  assert.equal(builds, 1);
}

let verified;
const reused = await verifiedImagesForSeedCommand({
  command: "reset-bootstrap",
  runtime,
  manifestPath: "/owned/runtime.json",
  build: () => assert.fail("reset-bootstrap must not rebuild"),
  load: async (manifestPath, actualRuntime) => {
    assert.equal(manifestPath, "/owned/runtime.json");
    assert.equal(actualRuntime, runtime);
    return imageIds;
  },
  verifyRunning: (actualRuntime, actualIds) => {
    verified = { actualRuntime, actualIds };
  },
});
assert.equal(reused, imageIds);
assert.deepEqual(verified, { actualRuntime: runtime, actualIds: imageIds });

await assert.rejects(
  () =>
    verifiedImagesForSeedCommand({
      command: "reset-bootstrap",
      runtime,
      load: async () => undefined,
    }),
  /manifest-image-ids-missing/,
);
assert.equal(
  await verifiedImagesForSeedCommand({ command: "inventory" }),
  undefined,
);
console.log("parity seed verified images self-test passed");
