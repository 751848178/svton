import {
  historyResult,
  requireDistinct,
  requireEqual,
  requireIdentity,
} from "./parity-negative-history-identity-assert.mjs";

export function validateHistorySummary(steps, anchors) {
  const result = historyResult(steps, "version-chains");
  const staging = result.staging?.chain;
  requireEqual(
    staging,
    [
      {
        id: anchors.stagingCurrentVersionId,
        kind: "deploy",
        prev: null,
        manifest: anchors.manifestId,
      },
      {
        id: anchors.stagingVersionV2,
        kind: "deploy",
        prev: anchors.stagingCurrentVersionId,
        manifest: anchors.manifestId,
      },
      {
        id: anchors.stagingVersionV3,
        kind: "upgrade",
        prev: anchors.stagingVersionV2,
        manifest: anchors.manifestM2,
      },
      {
        id: anchors.stagingVersionV4,
        kind: "recovery",
        prev: anchors.stagingVersionV3,
        manifest: anchors.manifestId,
      },
    ],
    "summary:staging-chain",
  );

  const production = result.production?.chain;
  requireIdentity(Array.isArray(production), "summary:production-chain");
  const rootIndex = production.findIndex(
    (row) => row.id === anchors.productionCurrentVersionId,
  );
  const suffix = production.slice(rootIndex);
  requireIdentity(
    rootIndex >= 0 && suffix.length === 3,
    "summary:production-suffix",
  );
  requireEqual(
    suffix.map(({ id, kind, manifest }) => ({ id, kind, manifest })),
    [
      {
        id: anchors.productionCurrentVersionId,
        kind: "upgrade",
        manifest: anchors.manifestId,
      },
      {
        id: anchors.productionVersionV2,
        kind: "upgrade",
        manifest: anchors.manifestM2,
      },
      {
        id: anchors.productionVersionV3,
        kind: "recovery",
        manifest: anchors.manifestId,
      },
    ],
    "summary:production-identities",
  );
  requireEqual(
    [suffix[1].prev, suffix[2].prev],
    [anchors.productionCurrentVersionId, anchors.productionVersionV2],
    "summary:production-links",
  );

  const expectedReleaseRuns = [
    { id: anchors.productionReleaseRunId, mode: "standard" },
    { id: anchors.productionReleaseRunR2, mode: "standard" },
    { id: anchors.productionReleaseRunR3, mode: "recovery" },
  ];
  requireEqual(
    result.expectedReleaseRuns,
    expectedReleaseRuns,
    "summary:expected-releases",
  );
  requireIdentity(result.releaseRuns?.length === 3, "summary:release-count");
  requireDistinct(
    result.releaseRuns.map((row) => row?.id),
    "summary:release-ids",
  );
  for (const expected of expectedReleaseRuns) {
    const matches = result.releaseRuns.filter((row) => row.id === expected.id);
    requireEqual(
      matches,
      [{ ...expected, status: "succeeded" }],
      `summary:release-${expected.id}`,
    );
  }
  requireEqual(
    [
      result.stagingRecoverySourcePresent,
      result.productionRecoverySourcePresent,
    ],
    [true, true],
    "summary:recovery-sources",
  );
}
