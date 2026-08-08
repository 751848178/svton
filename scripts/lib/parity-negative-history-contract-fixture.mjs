import {
  HISTORY_AC_MAPPING,
  historyStepChecks,
} from "./parity-history-e2e-evidence.mjs";
import { identityFixtures } from "./parity-history-identity-fixtures.mjs";
import {
  BASE_MANIFEST_DIGEST,
  baseContextFixture,
  baseRowsFixture,
} from "./parity-negative-history-base-fixture.mjs";
import { productionActionFixture } from "./parity-negative-history-production-fixture.mjs";
import {
  browserPassFixture,
  versionChainsFixture,
} from "./parity-negative-history-summary-fixture.mjs";
import {
  HISTORY_OBJECTIVE,
  HISTORY_WORKER,
} from "./parity-negative-history-contract.mjs";

const DIGEST_2 = `sha256:${"b".repeat(64)}`;

export function historyDocumentFixture() {
  const context = baseContextFixture();
  const results = resultFixtures(context);
  const steps = Object.fromEntries(
    Object.entries(results).map(([name, result]) => [
      name,
      passedStep(name, result),
    ]),
  );
  const document = {
    worker: HISTORY_WORKER,
    objective: HISTORY_OBJECTIVE,
    status: "passed",
    capturedAt: "2026-08-08T00:00:00Z",
    context,
    steps,
    ac: acceptanceFromSteps(steps),
  };
  return JSON.parse(JSON.stringify(document));
}

export function acceptanceFromSteps(steps) {
  return Object.fromEntries(
    Object.entries(HISTORY_AC_MAPPING).map(([id, sourceSteps]) => [
      id,
      {
        ok: true,
        sourceSteps: [...sourceSteps],
        checkNames: sourceSteps.flatMap((name) =>
          steps[name].checks.map((item) => `${name}:${item.name}`),
        ),
      },
    ]),
  );
}

function passedStep(name, result) {
  const checks = historyStepChecks(name, result);
  if (checks.some((item) => item.pass !== true)) {
    throw new Error(`invalid canonical fixture: ${name}`);
  }
  return { ok: true, status: "passed", verified: true, checks, result };
}

function resultFixtures(context) {
  const identity = Object.fromEntries(
    identityFixtures().map(({ step, result }) => [step, result]),
  );
  return {
    login: {
      status: "authenticated",
      verified: true,
      email: "admin@parity.local",
      source: "bootstrap-admin-after-reset",
    },
    "base-state-rows": baseRowsFixture(context),
    "build-2": {
      buildRunId: "build-2",
      distinctFromB1: true,
      status: "succeeded",
      pinned: true,
      manifestId: "manifest-2",
      manifestDistinctFromM1: true,
      digestDeterministic: true,
      dbBuildRuns: 2,
      dbManifests: 2,
      manifestDigest: DIGEST_2,
    },
    "staging-deploy-repeat": repeatDeployment(),
    "staging-upgrade": identity["staging-upgrade"],
    "staging-recovery": identity["staging-recovery"],
    "production-preview": identity["production-preview"],
    "production-confirm": identity["production-confirm"],
    "production-approve": approvalFixture(),
    "production-upgrade-execute": productionActionFixture("upgrade"),
    "production-recovery-preview": identity["production-recovery-preview"],
    "production-recovery-confirm": identity["production-recovery-confirm"],
    "production-recovery-approve": approvalFixture(),
    "production-recovery-execute": productionActionFixture("recovery"),
    "version-chains": versionChainsFixture(),
    "browser-pass": browserPassFixture(),
  };
}

function repeatDeployment() {
  return {
    deploymentRunId: "deploy-2",
    firstDeploymentRunId: "deploy-1",
    distinctFromD1st: true,
    status: "completed",
    sameManifestM1: true,
    completedRunsOnM1: 2,
    buildRunCount: 2,
    newStagingCurrent: {
      deploymentRunId: "deploy-2",
      artifactManifestId: "manifest-1",
    },
    expectedManifestId: "manifest-1",
    artifactVerified: true,
    commandEvidence: {
      commandPlan: {
        steps: [
          "verify_manifest_digest",
          "materialize_exact_manifest",
          "start_workloads",
          "probe_workloads",
          "activate_release",
        ],
        checkout: false,
        pull: false,
        build: false,
      },
      providerEvidence: {
        checkoutInvoked: false,
        pullInvoked: false,
        buildInvoked: false,
        gitInvoked: false,
      },
      resultManifestId: "manifest-1",
      expectedManifestId: "manifest-1",
      paramsManifestId: "manifest-1",
      resultManifestDigest: BASE_MANIFEST_DIGEST,
      expectedManifestDigest: BASE_MANIFEST_DIGEST,
      paramsManifestDigest: BASE_MANIFEST_DIGEST,
    },
  };
}

function approvalFixture() {
  return {
    approvalId: "approval",
    status: "approved",
    reviewerId: "reviewer",
    reviewedAt: "2026-08-08T00:00:03.000Z",
  };
}
