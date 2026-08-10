import { historyStepChecks } from "./parity-history-e2e-evidence.mjs";

const SERIALIZED_CHECK_FIELDS = ["actual", "expected", "name", "pass"];

export function canonicalHistoryStepValid(name, step) {
  const expectedChecks = historyStepChecks(name, step?.result || {});
  return (
    step?.ok === true &&
    step.status === "passed" &&
    step.verified === true &&
    exactSerializedChecks(step.checks, expectedChecks)
  );
}

export function sameJsonValue(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function exactSerializedChecks(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length > 0 &&
    actual.length === expected.length &&
    actual.every((item, index) => {
      const canonical = expected[index];
      return (
        item !== null &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        canonical.pass === true &&
        sameJsonValue(Object.keys(item).sort(), SERIALIZED_CHECK_FIELDS) &&
        item.name === canonical.name &&
        item.pass === true &&
        sameJsonValue(item.actual, canonical.actual) &&
        sameJsonValue(item.expected, canonical.expected)
      );
    })
  );
}
