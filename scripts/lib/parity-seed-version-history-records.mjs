import { createHash } from "node:crypto";

export function buildParityVersionHistoryRecords({
  ids,
  pinnedCommit,
  digestA,
  digestB,
  capturedAt,
}) {
  const records = [
    record({
      ids,
      pinnedCommit,
      digest: digestA,
      capturedAt,
      key: "A",
      revision: 1,
      ageDays: 14,
    }),
    record({
      ids,
      pinnedCommit,
      digest: digestB,
      capturedAt,
      key: "B",
      revision: 2,
      ageDays: 7,
    }),
  ];
  assertParityVersionHistoryRecords(records);
  return records;
}

export function assertParityVersionHistoryRecords(records) {
  if (records.length !== 2)
    throw new Error("parity version history requires exactly two records");
  const identityKeys = [
    "buildId",
    "manifestId",
    "stagingDeploymentId",
    "stagingVersionId",
    "approvalId",
    "releaseRunId",
    "productionDeploymentId",
    "productionVersionId",
  ];
  for (const key of identityKeys) {
    const values = records.map((entry) => entry[key]);
    if (
      values.some((value) => !value) ||
      new Set(values).size !== values.length
    ) {
      throw new Error(
        `parity version history ${key} identities must be nonempty and distinct`,
      );
    }
  }
  if (records[0].kind !== "deploy" || records[1].kind !== "upgrade") {
    throw new Error("parity version history must model deploy then upgrade");
  }
  if (records[0].effectiveAt >= records[1].effectiveAt) {
    throw new Error("parity version history effectiveAt order is invalid");
  }
}

export function parityHistoryOrderCreatedAt(records) {
  assertParityVersionHistoryRecords(records);
  return new Date(records[0].effectiveAt.getTime() - 1);
}

function record({
  ids,
  pinnedCommit,
  digest,
  capturedAt,
  key,
  revision,
  ageDays,
}) {
  const suffix = key.toLowerCase();
  const inputHash = createHash("sha256")
    .update(`parity-prev-release-${suffix}-${digest}`)
    .digest("hex");
  return {
    key,
    kind: revision === 1 ? "deploy" : "upgrade",
    revision,
    digest,
    pinnedCommit,
    effectiveAt: new Date(capturedAt.getTime() - ageDays * 86_400_000),
    inputHash,
    buildId: ids[`buildPrev${key}`],
    manifestId: ids[`manifestPrev${key}`],
    manifestItemId: `parity-manifest-prev-item-${suffix}-0001`,
    stagingDeploymentId: ids[`stagingDeployPrev${key}`],
    stagingVersionId: ids[`stagingEnvVersionPrev${key}`],
    approvalId: ids[`approvalPrev${key}`],
    releaseRunId: ids[`releasePrev${key}`],
    productionDeploymentId: ids[`deployPrev${key}`],
    productionVersionId: ids[`envVersionPrev${key}`],
  };
}
