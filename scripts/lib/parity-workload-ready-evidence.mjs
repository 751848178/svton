import { check, predicate } from "./parity-e2e-evidence.mjs";

export function workloadReadyEvidenceChecks(value = {}) {
  return [
    check("workloadReadyStatus", value.status, "passed"),
    predicate(
      "workloadReadyInputHash",
      /^[a-f0-9]{64}$/.test(value.inputHash || ""),
      value.inputHash,
    ),
    predicate(
      "workloadReadyServiceCount",
      Number.isInteger(value.serviceCount) && value.serviceCount > 0,
      value.serviceCount,
    ),
    predicate(
      "workloadReadyServices",
      Array.isArray(value.services) &&
        value.services.length === value.serviceCount,
      value.services,
    ),
  ];
}
