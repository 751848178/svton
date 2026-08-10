import { predicate } from "./parity-e2e-evidence.mjs";
import {
  HISTORY_OBJECTIVE,
  HISTORY_WORKER,
} from "./parity-negative-history-contract.mjs";
import {
  eq,
  present,
  rejected,
  sameSet,
  yes,
  zero,
} from "./parity-negative-e2e-check-utils.mjs";

const advanced = ["canary", "blue_green", "automatic_traffic"];
const missing = [
  "real_traffic_provider",
  "candidate_and_stable_workloads",
  "metric_analysis_provider",
  "pause_and_abort_provider",
  "automatic_rollback_provider",
];
const expectedHistoryAc = Array.from(
  { length: 8 },
  (_, index) => `AC-E2E-${String(index + 16).padStart(3, "0")}`,
);

export const NEGATIVE_CHECKS_A = {
  "history-context": (r) => [
    eq("status", r.status, "passed"),
    eq("worker", r.worker, HISTORY_WORKER),
    eq("objective", r.objective, HISTORY_OBJECTIVE),
    yes("historyContractValid", r.historyContractValid),
    yes("databaseBindingValid", r.databaseBindingValid),
    present("teamId", r.teamId),
    present("projectId", r.projectId),
    present("orderId", r.orderId),
    eq("sourceSha256", r.sourceSha256, r.expectedSourceSha256),
    predicate(
      "historyAcceptanceIds",
      sameSet(r.historyAcceptanceIds, expectedHistoryAc),
      r.historyAcceptanceIds,
    ),
    yes("historyAcceptancePassed", r.historyAcceptancePassed),
    present("manifestM1", r.manifestM1),
    present("manifestM2", r.manifestM2),
    predicate("distinctManifests", r.manifestM1 !== r.manifestM2),
    predicate(
      "M1Digest",
      /^sha256:[a-f0-9]{64}$/.test(r.manifestM1Digest ?? ""),
      r.manifestM1Digest,
    ),
    predicate(
      "M2Digest",
      /^sha256:[a-f0-9]{64}$/.test(r.manifestM2Digest ?? ""),
      r.manifestM2Digest,
    ),
    present("crossOrderManifestId", r.crossOrderManifestId),
    predicate(
      "crossOrderReleaseOrder",
      r.crossOrderReleaseOrderId !== r.orderId,
      r.crossOrderReleaseOrderId,
    ),
  ],
  preflight: (r) => [
    yes("apiHealth", r.apiHealth),
    eq("webStatus", r.webStatus, 200),
    eq("targetStatus", r.targetStatus, 200),
    yes("target404Definitive", r.target404Definitive),
  ],
  login: (r) => [
    eq("status", r.status, "passed"),
    yes("verified", r.verified),
    present("email", r.email),
  ],
  fixtures: (r) => [
    yes("seeded", r.seeded),
    yes("uniqueFixtureIds", r.uniqueFixtureIds),
    zero("runningReleaseRuns", r.runningReleaseRuns),
  ],
  "ac-024-build-no-repo-rejected": (r) => [
    ...rejected(r, "RELEASE_GATE_BLOCKED"),
    eq("decisionAllowed", r.decisionAllowed, false),
    predicate(
      "blockerC01",
      r.decisionBlockers?.includes("C01"),
      r.decisionBlockers,
    ),
    eq("decisionStage", r.decisionStage, "build"),
    yes("decisionConsumedAtNull", r.decisionConsumedAtNull),
    zero("dbBuildRunDelta", r.dbBuildRunDelta),
  ],
  "ac-024-db-state": (r) => [
    zero("dbBuildRunDelta", r.dbBuildRunDelta),
    eq("decisionAllowed", r.decisionAllowed, false),
    eq("c01Status", r.c01?.status, "unavailable"),
    eq("c01Reason", r.c01?.reasonCode, "repository_not_connected"),
    yes("decisionConsumedAtNull", r.decisionConsumedAtNull),
  ],
  "ac-025-setup-failed-connection": (r) => [
    present("connectionId", r.connectionId),
    eq("status", r.status, "failed"),
  ],
  "ac-025-build-gate-rejected": (r) => [
    ...rejected(r, "RELEASE_GATE_BLOCKED"),
    eq("decisionAllowed", r.decisionAllowed, false),
    predicate(
      "blockerC01",
      r.decisionBlockers?.includes("C01"),
      r.decisionBlockers,
    ),
    eq("c01Status", r.c01?.status, "blocked"),
    eq("c01Reason", r.c01?.reasonCode, "repository_verification_failed"),
    zero("dbBuildRunDelta", r.dbBuildRunDelta),
  ],
  "ac-025-cleanup": (r) => [
    yes("cleaned", r.cleaned),
    zero("dbBuildRunDelta", r.dbBuildRunDelta),
  ],
  "ac-026-capability-unavailable": (r) => [
    eq("strategyCount", r.capabilities?.length, 4),
    yes(
      "standardExecutable",
      r.capabilities?.find((x) => x.strategy === "standard")?.executable,
    ),
    ...advanced.flatMap((strategy) => {
      const item = r.capabilities?.find((x) => x.strategy === strategy);
      return [
        eq(`${strategy}Executable`, item?.executable, false),
        eq(
          `${strategy}Reason`,
          item?.reasonCode,
          "release_strategy_capabilities_unavailable",
        ),
        predicate(
          `${strategy}MissingSet`,
          sameSet(item?.missingCapabilities, missing),
          item?.missingCapabilities,
        ),
      ];
    }),
  ],
  "ac-026-preview-rejected": (r) =>
    rejected(r, "release_strategy_capabilities_unavailable"),
  "ac-026-confirm-rejected": (r) => [
    ...rejected(r, "release_strategy_capabilities_unavailable"),
    zero("releaseRunDelta", r.releaseRunDelta),
  ],
  "ac-027-cross-project-manifest": (r) => [
    eq("status", r.status, 404),
    zero("dbDeploymentRunDelta", r.dbDeploymentRunDelta),
  ],
  "ac-027-cross-order-manifest": (r) => [
    eq("status", r.status, 404),
    zero("dbDeploymentRunDelta", r.dbDeploymentRunDelta),
  ],
  "ac-028-tamper-digest": (r) => [
    present("tamperedItem", r.tamperedItem),
    yes("digestChanged", r.digestChanged),
    predicate(
      "originalDigest",
      /^sha256:[a-f0-9]{64}$/.test(r.originalDigest ?? ""),
      r.originalDigest,
    ),
  ],
  "ac-028-deploy-rejected": (r) => [
    eq("status", r.status, 422),
    predicate(
      "integrityMessage",
      /制品|digest|integrity/i.test(r.message ?? ""),
      r.message,
    ),
    zero("dbDeploymentRunDelta", r.dbDeploymentRunDelta),
  ],
  "ac-028-restore-digest": (r) => [
    yes("restored", r.restored),
    predicate(
      "restoredDigest",
      /^sha256:[a-f0-9]{64}$/.test(r.restoredDigest ?? ""),
      r.restoredDigest,
    ),
    predicate(
      "expectedDigest",
      /^sha256:[a-f0-9]{64}$/.test(r.expectedDigest ?? ""),
      r.expectedDigest,
    ),
    eq("digestMatch", r.restoredDigest, r.expectedDigest),
  ],
};
