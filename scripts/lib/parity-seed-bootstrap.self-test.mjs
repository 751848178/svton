import assert from "node:assert/strict";
import { deleteLegacySeedProjectGraph } from "./parity-seed-bootstrap.mjs";

const calls = [];
const tx = Object.fromEntries(
  [
    ["projectEnvironment", "updateMany"],
    ["environmentVersion", "deleteMany"],
    ["releaseRun", "deleteMany"],
    ["deploymentRun", "deleteMany"],
    ["artifactManifest", "deleteMany"],
    ["buildRun", "deleteMany"],
    ["projectIntakeFinalization", "deleteMany"],
    ["project", "deleteMany"],
  ].map(([model, operation]) => [
    model,
    {
      [operation]: async (input) => {
        calls.push({ model, operation, input });
      },
    },
  ]),
);

await deleteLegacySeedProjectGraph(tx, "legacy-project");
assert.deepEqual(
  calls.map(({ model }) => model),
  [
    "projectEnvironment",
    "environmentVersion",
    "releaseRun",
    "deploymentRun",
    "artifactManifest",
    "buildRun",
    "projectIntakeFinalization",
    "project",
  ],
);
assert.deepEqual(calls[0].input, {
  where: { projectId: "legacy-project" },
  data: {
    currentEnvironmentVersionId: null,
    currentConfigRevisionId: null,
  },
});
for (const call of calls.slice(1, -1)) {
  assert.deepEqual(call.input, { where: { projectId: "legacy-project" } });
}
assert.deepEqual(calls.at(-1).input, { where: { id: "legacy-project" } });
console.log("parity seed bootstrap teardown self-test passed");
