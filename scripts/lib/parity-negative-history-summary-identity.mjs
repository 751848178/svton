import {
  historyResult,
  requireDistinct,
  requireEqual,
  requireIdentity,
} from "./parity-negative-history-identity-assert.mjs";
import { POSITIVE_DELIVERY_FIXTURE_IDS } from "./parity-positive-delivery-fixture-ids.mjs";

export function validateHistorySummary(steps, anchors) {
  const result = historyResult(steps, "version-chains");
  const staging = result.staging?.chain;
  requireEqual(
    staging,
    [
      {
        id: anchors.stagingCurrentVersionId,
        kind: "deploy",
        prev: POSITIVE_DELIVERY_FIXTURE_IDS.stagingEnvVersionPrevB,
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
  requireEqual(
    production,
    [
      {
        id: anchors.productionCurrentVersionId,
        kind: "upgrade",
        prev: POSITIVE_DELIVERY_FIXTURE_IDS.envVersionPrevB,
        manifest: anchors.manifestId,
      },
      {
        id: anchors.productionVersionV2,
        kind: "upgrade",
        prev: anchors.productionCurrentVersionId,
        manifest: anchors.manifestM2,
      },
      {
        id: anchors.productionVersionV3,
        kind: "recovery",
        prev: anchors.productionVersionV2,
        manifest: anchors.manifestId,
      },
    ],
    "summary:production-chain",
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
