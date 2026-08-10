import assert from "node:assert/strict";
import { createPositiveIntakeFlow } from "./parity-positive-intake-flow.mjs";

const calls = [];
const responses = [
  { id: "fresh-project" },
  { project: { id: "fresh-project", onboardingStatus: "draft" } },
  {
    id: "connection-1",
    provider: "local",
    selectedBranch: "main",
    commitSha: "a".repeat(40),
    status: "connected",
  },
  { id: "fresh-analysis" },
  {
    id: "fresh-analysis",
    status: "succeeded",
    commitSha: "a".repeat(40),
    result: {
      services: [{ key: "web" }],
      repository: { packageManager: "pnpm" },
    },
  },
  {
    overview: { suggestionId: "overview", kind: "overview" },
    components: [],
    dependencies: [{ suggestionId: "resource", kind: "resource_requirement" }],
  },
  { snapshot: { id: "snapshot", hash: "b".repeat(64) } },
  {
    projectId: "fresh-project",
    repositoryIdentityId: "identity-1",
    onboardingRevision: 4,
    environments: [],
  },
  { project: { id: "fresh-project", onboardingStatus: "ready" } },
];
const flow = createPositiveIntakeFlow({
  pinnedCommit: "a".repeat(40),
  runKey: "proof",
  async request(method, path, body) {
    calls.push({ method, path, body });
    return responses.shift();
  },
});
assert.equal((await flow.draft()).project.id, "fresh-project");
assert.equal((await flow.connect()).status, "connected");
assert.equal((await flow.analyze()).runId, "fresh-analysis");
assert.equal((await flow.contract()).suggestionCount, 2);
assert.equal((await flow.review()).reviewSnapshotId, "snapshot");
assert.equal((await flow.finalize()).status, "ready");
assert.equal(flow.projectId(), "fresh-project");
assert.deepEqual(flow.context(), {
  projectId: "fresh-project",
  connectionId: "connection-1",
  analysisRunId: "fresh-analysis",
  reviewSnapshotId: "snapshot",
  reviewSnapshotHash: "b".repeat(64),
});
assert.deepEqual(calls[6].body.items, [
  { suggestionId: "overview", decision: "accept" },
  { suggestionId: "resource", decision: "reject" },
]);
assert.equal(
  calls[2].body.repositoryUrl,
  "/read-only-repositories/parity-app-intake",
);

console.log("parity positive intake flow self-test passed");
