#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkedStep, check } from "./parity-e2e-evidence.mjs";
import {
  HISTORY_AC_MAPPING,
  historyStepChecks,
} from "./parity-history-e2e-evidence.mjs";
import { extractPositiveHistoryContext } from "./parity-history-context.mjs";
import {
  deletePath,
  identityFixtures,
} from "./parity-history-identity-fixtures.mjs";

const selfPath = fileURLToPath(import.meta.url);
const root = resolve(dirname(selfPath), "../..");

if (process.argv.includes("--false-fixture")) {
  const evidence = { status: "running", steps: {}, ac: {} };
  await checkedStep(
    evidence,
    "build-2",
    async () => ({ status: "failed" }),
    (result) => [check("status", result.status, "succeeded")],
  );
} else {
  const child = spawnSync(process.execPath, [selfPath, "--false-fixture"], {
    encoding: "utf8",
  });
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /E2E_ASSERTION_FAILED build-2: status/);

  assert.equal(Object.keys(HISTORY_AC_MAPPING).length, 8);
  const mappedSteps = new Set(Object.values(HISTORY_AC_MAPPING).flat());
  assert.equal(mappedSteps.size, 15);
  assert.ok(
    Object.values(HISTORY_AC_MAPPING).every((steps) => steps.includes("login")),
  );
  for (const step of mappedSteps) {
    const checks = historyStepChecks(step, {});
    assert.ok(checks.length > 0, `${step} has zero checks`);
    assert.ok(
      checks.some((item) => item.pass !== true),
      `${step} accepts empty payload`,
    );
  }
  assert.ok(historyStepChecks("login", {}).some((item) => !item.pass));
  assert.ok(
    historyStepChecks("login", {
      status: "authenticated",
      verified: false,
      email: "admin@parity.local",
      source: "bootstrap-admin-after-reset",
    }).some((item) => !item.pass),
  );
  assert.deepEqual(
    historyStepChecks("login", {
      status: "authenticated",
      verified: true,
      email: "admin@parity.local",
      source: "bootstrap-admin-after-reset",
    }).filter((item) => !item.pass),
    [],
  );

  for (const { step, result, pairs } of identityFixtures()) {
    assert.deepEqual(
      historyStepChecks(step, result).filter((item) => !item.pass),
      [],
      `${step} fixture invalid`,
    );
    for (const [actualPath, expectedPath] of pairs) {
      for (const missing of [
        [actualPath],
        [expectedPath],
        [actualPath, expectedPath],
      ]) {
        const adversarial = structuredClone(result);
        missing.forEach((path) => deletePath(adversarial, path));
        assert.ok(
          historyStepChecks(step, adversarial).some((item) => !item.pass),
          `${step} accepts missing ${missing.join("+")}`,
        );
      }
    }
  }

  const validDocument = positiveDocument();
  const extracted = extractPositiveHistoryContext(
    validDocument,
    "b".repeat(64),
  );
  assert.deepEqual(
    extracted.checks.filter((item) => item.pass !== true),
    [],
  );
  const missing = structuredClone(validDocument);
  delete missing.steps.build.result.manifestId;
  assert.ok(
    extractPositiveHistoryContext(missing, "b".repeat(64)).checks.some(
      (item) => item.pass !== true,
    ),
  );

  const driver = await readFile(
    resolve(root, "scripts/parity-version-history-e2e.mjs"),
    "utf8",
  );
  const driverSteps = [...driver.matchAll(/await step\("([^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.equal(driverSteps.length, 20);
  assert.equal(new Set(driverSteps).size, 20);
  for (const step of driverSteps) {
    assert.notEqual(
      historyStepChecks(step, {})[0]?.name,
      "registeredStep",
      `${step} is unregistered`,
    );
  }
  assert.doesNotMatch(driver, /["']AC-E2E-\d+["']\s*:\s*\{\s*ok\s*:\s*true/);
  assert.doesNotMatch(driver, /evidence\.steps(?:\.[\w-]+|\[[^\]]+\])\s*=/);
  assert.doesNotMatch(driver, /\bok\s*:\s*true/);
  assert.doesNotMatch(driver, /\b(?:token|accessToken)\s*:/);
  assert.doesNotMatch(
    driver,
    /const (projectId|orderId|stagingEnvId|productionEnvId)\s*=\s*["']/,
  );
  assert.match(driver, /finishEvidence\(evidence, HISTORY_AC_MAPPING\)/);
  process.stdout.write("history e2e evidence self-test passed\n");
}

function positiveDocument() {
  return {
    status: "passed",
    capturedAt: "2026-08-08T00:00:00.000Z",
    stack: { pinnedCommit: "a".repeat(40) },
    fixedIds: { teamId: "team", projectId: "project", orderId: "order" },
    ac: { "AC-E2E-007": { ok: true } },
    steps: {
      build: {
        result: {
          buildRunId: "build",
          manifestId: "manifest",
          manifestDigest: `sha256:${"a".repeat(64)}`,
        },
      },
      "staging-deploy": { result: { deploymentRunId: "staging-run" } },
      "baselines-verified": {
        result: { stagingId: "staging", productionId: "production" },
      },
      "production-current-version": {
        result: {
          stagingCurrent: "staging-version",
          currentEnvironmentVersionId: "production-version",
        },
      },
      "env-save-r2-production": {
        result: {
          id: "config-2",
          snapshot: { routeSnapshot: { domains: ["example.test"] } },
        },
      },
      "env-targets": {
        result: { production: { current: { targetRef: "target" } } },
      },
    },
  };
}
