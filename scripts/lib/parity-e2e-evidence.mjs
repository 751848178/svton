export function check(name, actual, expected) {
  return { name, pass: Object.is(actual, expected), actual, expected };
}

export function predicate(name, pass, actual = pass) {
  return { name, pass: pass === true, actual, expected: true };
}

export async function checkedStep(evidence, name, action, verify, log = () => {}) {
  const startedAt = Date.now();
  let result;
  let checks = [];
  try {
    result = await action();
    checks = normalizeChecks(verify?.(result));
    const failed = checks.filter((item) => item.pass !== true);
    if (failed.length > 0) {
      throw assertionError(name, failed);
    }
    evidence.steps[name] = {
      ok: true,
      status: "passed",
      verified: true,
      ms: Date.now() - startedAt,
      checks: sanitize(checks),
      result: sanitize(result),
    };
    log(`step ${name} OK (${Date.now() - startedAt}ms)`);
    return result;
  } catch (error) {
    evidence.steps[name] = {
      ok: false,
      status: "failed",
      verified: checks.length > 0,
      ms: Date.now() - startedAt,
      checks: sanitize(checks),
      result: sanitize(result),
      error: error.message || String(error),
    };
    evidence.status = "failed";
    log(`step ${name} FAILED: ${error.message || error}`);
    throw error;
  }
}

export function deriveAcceptance(evidence, mapping) {
  const acceptance = {};
  for (const [acId, sourceSteps] of Object.entries(mapping)) {
    const failures = [];
    const checkNames = [];
    for (const stepName of sourceSteps) {
      const step = evidence.steps[stepName];
      if (!step) {
        failures.push(`${stepName}:missing`);
        continue;
      }
      if (step.ok !== true || step.status !== "passed") failures.push(`${stepName}:failed`);
      if (step.verified !== true || !Array.isArray(step.checks) || step.checks.length === 0) {
        failures.push(`${stepName}:unverified`);
        continue;
      }
      const failedChecks = step.checks.filter((item) => item.pass !== true);
      failures.push(...failedChecks.map((item) => `${stepName}:${item.name}`));
      checkNames.push(...step.checks.map((item) => `${stepName}:${item.name}`));
    }
    acceptance[acId] = {
      ok: failures.length === 0,
      sourceSteps: [...sourceSteps],
      checkNames,
      ...(failures.length > 0 ? { failures } : {}),
    };
  }
  evidence.ac = acceptance;
  const failed = Object.entries(acceptance).filter(([, value]) => value.ok !== true);
  if (failed.length > 0) {
    evidence.status = "failed";
    throw assertionError("acceptance", failed.map(([name]) => ({ name, pass: false })));
  }
  return acceptance;
}

export function finishEvidence(evidence, mapping) {
  const acceptance = deriveAcceptance(evidence, mapping);
  evidence.status = "passed";
  return acceptance;
}

function normalizeChecks(value) {
  const checks = Array.isArray(value) ? value : [];
  if (checks.length === 0) throw assertionError("verification", [{ name: "zero-checks" }]);
  for (const item of checks) {
    if (!item || typeof item.name !== "string" || item.name.length === 0) {
      throw assertionError("verification", [{ name: "unnamed-check" }]);
    }
  }
  return checks;
}

function assertionError(scope, failed) {
  const names = failed.map((item) => item.name).join(", ");
  const error = new Error(`E2E_ASSERTION_FAILED ${scope}: ${names}`);
  error.code = "E2E_ASSERTION_FAILED";
  return error;
}

function sanitize(value) {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value, (_, item) =>
    typeof item === "bigint" ? item.toString() : item));
}
