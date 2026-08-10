#!/usr/bin/env node
import assert from "node:assert/strict";
import { negativeStepChecks } from "./parity-negative-e2e-evidence.mjs";
import { bindNegativeHistoryContext } from "./parity-negative-history-db-binding.mjs";
import {
  HISTORY_OBJECTIVE,
  HISTORY_WORKER,
} from "./parity-negative-history-contract.mjs";
import { HISTORY_AC_MAPPING } from "./parity-history-e2e-evidence.mjs";

const context = historyContext();
const { client, rows } = databaseFixture(context);
const bound = await bindNegativeHistoryContext(client, context);
assert.equal(bound.databaseBindingValid, true);
assert.equal(bound.crossOrderManifestId, "manifest-cross");
assert.notEqual(bound.crossOrderReleaseOrderId, context.orderId);
assert.deepEqual(
  negativeStepChecks("history-context", bound).filter((item) => !item.pass),
  [],
);

await rejectDatabase("missing cross-order", context, (value) => {
  value.crossOrder = null;
});
await rejectDatabase("other project", context, (value) => {
  scopeRow(value.crossOrder, { projectId: "other" });
});
await rejectDatabase("other team", context, (value) => {
  scopeRow(value.crossOrder, { teamId: "other" });
});
await rejectDatabase("current order", context, (value) => {
  scopeRow(value.crossOrder, { releaseOrderId: context.orderId });
});
await rejectDatabase("failed cross-order build", context, (value) => {
  value.crossOrder.buildRun.status = "failed";
});
rows.manifests[0].projectId = "other";
await assert.rejects(
  bindNegativeHistoryContext(client, context),
  /scope mismatch/,
);

const shared = historyContext();
shared.buildRunM2 = shared.buildRunM1;
await assert.rejects(
  bindNegativeHistoryContext(databaseFixture(shared).client, shared),
  /share build run/,
);

await rejectDatabase("failed manifest build", context, (value) => {
  value.manifests[0].buildRun.status = "failed";
});
await rejectDatabase("manifest build order mismatch", context, (value) => {
  value.manifests[0].buildRun.releaseOrderId = "other-order";
});
await rejectDatabase("manifest build project mismatch", context, (value) => {
  value.manifests[0].buildRun.projectId = "other";
});
await rejectDatabase("manifest build team mismatch", context, (value) => {
  value.manifests[0].buildRun.teamId = "other";
});
await rejectDatabase("missing manifest build run", context, (value) => {
  value.manifests[0].buildRun = null;
});

process.stdout.write("negative history DB binding self-test passed\n");

function historyContext() {
  return {
    worker: HISTORY_WORKER,
    objective: HISTORY_OBJECTIVE,
    status: "passed",
    sourceSha256: "d".repeat(64),
    expectedSourceSha256: "d".repeat(64),
    historyAcceptanceIds: Object.keys(HISTORY_AC_MAPPING).sort(),
    historyAcceptancePassed: true,
    historyContractValid: true,
    teamId: "team",
    projectId: "project",
    orderId: "order",
    manifestM1: "manifest-1",
    manifestM1Digest: `sha256:${"a".repeat(64)}`,
    buildRunM1: "build-1",
    manifestM2: "manifest-2",
    manifestM2Digest: `sha256:${"b".repeat(64)}`,
    buildRunM2: "build-2",
  };
}

function databaseFixture(value) {
  const current = {
    id: value.orderId,
    teamId: value.teamId,
    projectId: value.projectId,
  };
  const manifests = [
    manifestRow(
      value.manifestM1,
      value.buildRunM1,
      value.manifestM1Digest,
      current,
    ),
    manifestRow(
      value.manifestM2,
      value.buildRunM2,
      value.manifestM2Digest,
      current,
    ),
  ];
  const crossOrder = manifestRow(
    "manifest-cross",
    "build-cross",
    `sha256:${"c".repeat(64)}`,
    { ...current, id: "other-order" },
  );
  const rows = { manifests, crossOrder };
  return {
    rows,
    client: {
      project: {
        findUnique: async () => ({ id: value.projectId, teamId: value.teamId }),
      },
      releaseOrder: { findUnique: async () => current },
      artifactManifest: {
        findMany: async () => rows.manifests,
        findFirst: async () => rows.crossOrder,
      },
    },
  };
}

function manifestRow(id, buildRunId, digest, releaseOrder) {
  const scope = {
    teamId: releaseOrder.teamId,
    projectId: releaseOrder.projectId,
    releaseOrderId: releaseOrder.id,
  };
  return {
    id,
    ...scope,
    buildRunId,
    digest,
    releaseOrder,
    buildRun: { id: buildRunId, ...scope, status: "succeeded" },
  };
}

function scopeRow(row, values) {
  Object.assign(row, values);
  if (values.projectId) {
    row.releaseOrder.projectId = row.buildRun.projectId = values.projectId;
  }
  if (values.teamId) {
    row.releaseOrder.teamId = row.buildRun.teamId = values.teamId;
  }
  if (values.releaseOrderId) {
    row.releaseOrder.id = row.buildRun.releaseOrderId = values.releaseOrderId;
  }
}

async function rejectDatabase(label, value, mutate) {
  const { client, rows } = databaseFixture(value);
  mutate(rows);
  await assert.rejects(
    bindNegativeHistoryContext(client, value),
    undefined,
    label,
  );
}
