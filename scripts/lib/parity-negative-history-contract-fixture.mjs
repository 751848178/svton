import {
  HISTORY_AC_MAPPING,
  historyStepChecks,
} from "./parity-history-e2e-evidence.mjs";
import {
  baseContextFixture,
  baseRowsFixture,
} from "./parity-negative-history-base-fixture.mjs";
import { productionResultsFixture } from "./parity-negative-history-production-fixture.mjs";
import {
  historyAnchorFixture,
  stagingResultsFixture,
} from "./parity-negative-history-staging-fixture.mjs";
import {
  browserPassFixture,
  versionChainsFixture,
} from "./parity-negative-history-summary-fixture.mjs";
import {
  HISTORY_OBJECTIVE,
  HISTORY_WORKER,
} from "./parity-negative-history-contract.mjs";

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
  const anchors = historyAnchorFixture(context);
  return {
    login: {
      status: "authenticated",
      verified: true,
      email: "admin@parity.local",
      source: "bootstrap-admin-after-reset",
    },
    "base-state-rows": baseRowsFixture(context),
    ...stagingResultsFixture(anchors),
    ...productionResultsFixture(anchors),
    "version-chains": versionChainsFixture(anchors),
    "browser-pass": browserPassFixture(),
  };
}
