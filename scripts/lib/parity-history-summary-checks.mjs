import { check, predicate } from "./parity-e2e-evidence.mjs";
import {
  CDP_EVIDENCE_SCHEMA,
  CDP_EVIDENCE_VERSION,
} from "./parity-history-cdp-capture.mjs";
import { browserArtifactsValid } from "./parity-history-browser-artifacts.mjs";
import { browserMarkerGroupsValid } from "./parity-history-browser-marker-contract.mjs";
import { validateHttpResponses } from "./parity-history-cdp-response-schema.mjs";
import { validateCdpSessionIdentity } from "./parity-history-cdp-session-identity.mjs";

export const SUMMARY_HISTORY_STEP_CHECKS = {
  "version-chains": (r) => [
    check("stagingChain", r.staging?.chainLinksValid, true),
    check("stagingRuns", r.staging?.everyDeploymentCompleted, true),
    check("stagingDbCurrent", r.staging?.dbCurrentMatchesLatest, true),
    check("stagingApiCurrent", r.staging?.apiCurrentMatchesDb, true),
    check("productionChain", r.production?.chainLinksValid, true),
    check("productionRuns", r.production?.everyDeploymentCompleted, true),
    check("productionDbCurrent", r.production?.dbCurrentMatchesLatest, true),
    check("productionApiCurrent", r.production?.apiCurrentMatchesDb, true),
    check("stagingRecoverySource", r.stagingRecoverySourcePresent, true),
    check("productionRecoverySource", r.productionRecoverySourcePresent, true),
    predicate(
      "releaseRuns",
      releaseRunsMatch(r.expectedReleaseRuns, r.releaseRuns),
      r.releaseRuns,
    ),
  ],
  "db-summary": (r) => [
    check("buildRuns", r.buildRunsOnOrder, 2),
    check("stagingRuns", r.stagingDeploymentRuns, 4),
    check("productionRuns", r.productionDeploymentRuns, 3),
    check("environmentVersions", r.environmentVersions, 7),
    check("approvals", r.operationApprovals, 3),
    check("releaseRuns", r.releaseRuns, 3),
  ],
  "browser-pass": (r) => browserChecks(r),
};

function releaseRunsMatch(expected = [], actual = []) {
  return (
    expected.length > 0 &&
    expected.every((item) =>
      actual.some(
        (run) =>
          run.id === item.id &&
          run.mode === item.mode &&
          run.status === "succeeded",
      ),
    )
  );
}

function browserChecks(r) {
  const artifactsValid = browserArtifactsValid(
    r.requiredArtifacts,
    r.artifacts,
  );
  return [
    check("driverExit", r.driverExit, 0),
    predicate("requiredArtifacts", artifactsValid, r.artifacts),
    check("cdpSchema", r.cdpSchema, CDP_EVIDENCE_SCHEMA),
    check("cdpVersion", r.cdpVersion, CDP_EVIDENCE_VERSION),
    predicate(
      "cdpSessionIdentity",
      validSession(r.cdpSessionIdentity),
      r.cdpSessionIdentity,
    ),
    predicate("consoleArray", Array.isArray(r.consoleEvents), r.consoleEvents),
    check("consoleErrors", r.consoleErrors?.length, 0),
    check("badResponses", r.badResponses?.length, 0),
    predicate(
      "failedRequestsArray",
      Array.isArray(r.failedRequests),
      r.failedRequests,
    ),
    check(
      "failedRequests",
      Array.isArray(r.failedRequests) ? r.failedRequests.length : null,
      0,
    ),
    predicate(
      "runtimeExceptionsArray",
      Array.isArray(r.runtimeExceptions),
      r.runtimeExceptions,
    ),
    check(
      "runtimeExceptions",
      Array.isArray(r.runtimeExceptions) ? r.runtimeExceptions.length : null,
      0,
    ),
    predicate(
      "httpResponses",
      httpResponsesPass(r.httpResponses),
      r.httpResponses,
    ),
    predicate("markerGroups", browserMarkerGroupsValid(r), r),
  ];
}

function validSession(identity) {
  try {
    validateCdpSessionIdentity(identity);
    return true;
  } catch {
    return false;
  }
}

function httpResponsesPass(responses) {
  try {
    validateHttpResponses(responses);
    return responses.every((item) => item.status >= 200 && item.status < 400);
  } catch {
    return false;
  }
}
