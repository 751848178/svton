import { BROWSER_MARKER_GROUPS } from "./parity-history-browser-marker-contract.mjs";

export function versionChainsFixture() {
  const valid = {
    chainLinksValid: true,
    everyDeploymentCompleted: true,
    dbCurrentMatchesLatest: true,
    apiCurrentMatchesDb: true,
  };
  const expectedReleaseRuns = [
    { id: "standard", mode: "standard" },
    { id: "recovery", mode: "recovery" },
  ];
  return {
    staging: valid,
    production: structuredClone(valid),
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
    driverExit: 0,
    requiredArtifacts: ["proof.txt"],
    artifacts: {
      "proof.txt": { kind: "text", bytes: 16, sha256: "c".repeat(64) },
    },
    cdpSchema: "devpilot.parity-history.cdp-evidence",
    cdpVersion: 1,
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
