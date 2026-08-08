import { check, predicate } from "./parity-e2e-evidence.mjs";

export const eq = (name, actual, expected) => check(name, actual, expected);
export const yes = (name, actual) => predicate(name, actual === true, actual);
export const present = (name, actual) =>
  predicate(name, Boolean(actual), actual);
export const zero = (name, actual) => eq(name, actual, 0);

export const rejected = (result, code, message) => [
  eq("status", result.status, 422),
  eq("code", result.code, code),
  ...(message
    ? [predicate("message", message.test(result.message ?? ""), result.message)]
    : []),
];

export function approvalCase(result, expectedStatus) {
  return [
    eq("executeStatus", result.executeStatus, 422),
    eq("code", result.code, undefined),
    zero("dbDeploymentRunWithRun", result.dbDeploymentRunWithRun),
    eq("approvalStatus", result.approvalStatus, expectedStatus),
    eq(
      "runStatusBeforeCleanup",
      result.runStatusBeforeCleanup,
      "awaiting_approval",
    ),
    yes("runCanceled", result.runCanceled),
  ];
}

export function sameSet(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    [...actual]
      .sort()
      .every((item, index) => item === [...expected].sort()[index])
  );
}
