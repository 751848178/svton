import { BROWSER_MARKER_GROUPS } from "./parity-history-browser-marker-contract.mjs";
import {
  CDP_EVIDENCE_SCHEMA,
  CDP_EVIDENCE_VERSION,
} from "./parity-history-cdp-capture.mjs";

export function versionChainsFixture(a) {
  const valid = {
    chainLinksValid: true,
    everyDeploymentCompleted: true,
    dbCurrentMatchesLatest: true,
    apiCurrentMatchesDb: true,
  };
  const stagingKinds = ["deploy", "deploy", "upgrade", "recovery"];
  const productionKinds = ["upgrade", "upgrade", "recovery"];
  const stagingChain = [
    {
      id: a.stagingCurrentVersionId,
      kind: "deploy",
      prev: null,
      manifest: a.manifestId,
    },
    {
      id: a.stagingVersionV2,
      kind: "deploy",
      prev: a.stagingCurrentVersionId,
      manifest: a.manifestId,
    },
    {
      id: a.stagingVersionV3,
      kind: "upgrade",
      prev: a.stagingVersionV2,
      manifest: a.manifestM2,
    },
    {
      id: a.stagingVersionV4,
      kind: "recovery",
      prev: a.stagingVersionV3,
      manifest: a.manifestId,
    },
  ];
  const productionChain = [
    {
      id: a.productionCurrentVersionId,
      kind: "upgrade",
      prev: null,
      manifest: a.manifestId,
    },
    {
      id: a.productionVersionV2,
      kind: "upgrade",
      prev: a.productionCurrentVersionId,
      manifest: a.manifestM2,
    },
    {
      id: a.productionVersionV3,
      kind: "recovery",
      prev: a.productionVersionV2,
      manifest: a.manifestId,
    },
  ];
  const expectedReleaseRuns = [
    { id: a.productionReleaseRunId, mode: "standard" },
    { id: a.productionReleaseRunR2, mode: "standard" },
    { id: a.productionReleaseRunR3, mode: "recovery" },
  ];
  return {
    staging: { ...valid, chain: stagingChain, expectedKinds: stagingKinds },
    production: {
      ...structuredClone(valid),
      chain: productionChain,
      expectedKinds: productionKinds,
    },
    stagingRecoverySourcePresent: true,
    productionRecoverySourcePresent: true,
    expectedReleaseRuns,
    releaseRuns: expectedReleaseRuns.map((run) => ({
      ...run,
      status: "succeeded",
    })),
  };
}

export function browserPassFixture() {
  const markerGroups = Object.fromEntries(
    Object.entries(BROWSER_MARKER_GROUPS).map(([group, keys]) => [
      group,
      Object.fromEntries(keys.map((key) => [key, true])),
    ]),
  );
  return {
    driver: "<cdp-driver>",
    driverExit: 0,
    viewport: { width: 1484, height: 1324 },
    log: "<f456-browser-driver.log>",
    requiredArtifacts: ["proof.txt"],
    artifacts: {
      "proof.txt": { kind: "text", bytes: 16, sha256: "c".repeat(64) },
    },
    cdpSchema: CDP_EVIDENCE_SCHEMA,
    cdpVersion: CDP_EVIDENCE_VERSION,
    consoleEvents: [],
    consoleErrors: [],
    badResponses: [],
    failedRequests: [],
    runtimeExceptions: [],
    httpResponses: [
      {
        requestId: "request-1",
        url: "https://production.example.test/",
        host: "production.example.test",
        type: "Document",
        status: 200,
      },
    ],
    ...markerGroups,
  };
}
