import assert from "node:assert/strict";
import {
  assertNoRuntimeResources,
  assertOwnedRuntimeResources,
  assertRunningRuntimeProvenance,
  removeOwnedRuntimeImages,
} from "./parity-runtime-resource-ownership.mjs";
import { RUNTIME_LABELS } from "./parity-runtime-provenance.mjs";

const runtime = {
  composeProject: "devpilot-parity-c5-a1b2c3d4-1234abcd",
  apiImage: "devpilot-parity-api:a1b2c3d4-1234abcd",
  webImage: "devpilot-parity-web:a1b2c3d4-1234abcd",
  routeControlImage: "devpilot-parity-route-control:a1b2c3d4-1234abcd",
  sourceRevision: "a".repeat(40),
  sourceTreeSha256: "b".repeat(64),
  runtimeId: "c5-a1b2c3d4-1234abcd",
  goalId: "devpilot-v13-opencode-acceptance",
  cleanupOwnerToken: "c".repeat(64),
};
const labels = {
  [RUNTIME_LABELS.revision]: runtime.sourceRevision,
  [RUNTIME_LABELS.tree]: runtime.sourceTreeSha256,
  [RUNTIME_LABELS.runtime]: runtime.runtimeId,
  [RUNTIME_LABELS.goal]: runtime.goalId,
  [RUNTIME_LABELS.owner]: runtime.cleanupOwnerToken,
  "com.docker.compose.project": runtime.composeProject,
};
const expectedImageIds = {
  api: `sha256:${"1".repeat(64)}`,
  web: `sha256:${"2".repeat(64)}`,
  "route-control": `sha256:${"3".repeat(64)}`,
};

function executor(inventory) {
  return (args) => {
    const [kind, command] = args;
    if (command === "ls") {
      const reference = args.find((arg) =>
        String(arg).startsWith("reference="),
      );
      const ids =
        kind === "image"
          ? inventory.images.filter(
              (row) =>
                !reference || row.tag === reference.slice("reference=".length),
            )
          : inventory[`${kind}s`];
      return { status: 0, stdout: `${ids.map((row) => row.id).join("\n")}\n` };
    }
    if (kind === "image" && command === "rm") {
      return { status: 0, stdout: args[2] };
    }
    const id = args[2];
    if (kind === "image" && command === "inspect") {
      const row = inventory.images.find(
        (item) => item.tag === id || item.id === id,
      );
      if (!row) {
        return { status: 1, stderr: `No such image: ${id}`, stdout: "" };
      }
      return {
        status: 0,
        stdout: JSON.stringify([
          { Id: row.id, Config: { Labels: row.labels } },
        ]),
      };
    }
    const row = Object.values(inventory)
      .flat()
      .find((item) => item.id === id);
    const record =
      kind === "image"
        ? { Id: row.id, Config: { Labels: row.labels } }
        : { Id: row.id, Image: row.imageId, Labels: row.labels };
    return { status: 0, stdout: JSON.stringify([record]) };
  };
}

const owned = {
  containers: [
    ...["mysql", "redis", "deploy-target", "target-workload"].map(
      (service) => ({
        id: `${service}-container`,
        labels: { ...labels, "com.docker.compose.service": service },
        imageId: `${service}-image`,
      }),
    ),
    ...[
      ["api", runtime.apiImage, expectedImageIds.api],
      ["web", runtime.webImage, expectedImageIds.web],
      [
        "route-control",
        runtime.routeControlImage,
        expectedImageIds["route-control"],
      ],
    ].map(([service, , imageId]) => ({
      id: `${service}-container`,
      labels: { ...labels, "com.docker.compose.service": service },
      imageId,
    })),
  ],
  networks: [{ id: "network-1", labels }],
  volumes: [{ id: "volume-1", labels }],
  images: [
    { id: expectedImageIds.api, tag: runtime.apiImage, labels },
    { id: expectedImageIds.web, tag: runtime.webImage, labels },
    {
      id: expectedImageIds["route-control"],
      tag: runtime.routeControlImage,
      labels,
    },
  ],
};
assert.equal(
  assertOwnedRuntimeResources(runtime, executor(owned)).containers.length,
  7,
);
assert.equal(
  assertRunningRuntimeProvenance(runtime, expectedImageIds, executor(owned))
    .services.api.imageId,
  expectedImageIds.api,
);
assert.throws(
  () =>
    assertRunningRuntimeProvenance(
      runtime,
      { ...expectedImageIds, api: `sha256:${"4".repeat(64)}` },
      executor(owned),
    ),
  /api-running-image-mismatch/,
);
assert.equal(
  removeOwnedRuntimeImages(runtime, executor(owned), expectedImageIds).images
    .length,
  3,
);
assert.throws(
  () =>
    assertOwnedRuntimeResources(
      runtime,
      executor({
        ...owned,
        volumes: [
          {
            id: "volume-1",
            labels: { ...labels, [RUNTIME_LABELS.owner]: "d".repeat(64) },
          },
        ],
      }),
    ),
  /owner-mismatch/,
);
const empty = { containers: [], networks: [], volumes: [], images: [] };
assert.deepEqual(assertNoRuntimeResources(runtime, executor(empty)), empty);
assert.throws(
  () => assertNoRuntimeResources(runtime, executor(owned)),
  /residuals/,
);

const substituted = {
  id: `sha256:${"4".repeat(64)}`,
  tag: runtime.apiImage,
  labels: { ...labels, [RUNTIME_LABELS.owner]: "d".repeat(64) },
};
const tagDrift = {
  ...owned,
  images: [
    ...owned.images.map((image) => ({ ...image, tag: `dangling-${image.id}` })),
    substituted,
  ],
};
assert.deepEqual(
  assertOwnedRuntimeResources(
    runtime,
    executor(tagDrift),
    expectedImageIds,
  ).images.map((image) => image.id),
  Object.values(expectedImageIds),
);
assert.deepEqual(
  assertNoRuntimeResources(
    runtime,
    executor({ ...empty, images: [substituted] }),
    expectedImageIds,
  ),
  empty,
);

console.log("parity runtime resource ownership self-test passed");
