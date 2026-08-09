export const TRUSTED_INTAKE_CONTEXT_FIELDS = Object.freeze([
  "repositoryConnectionId",
  "analysisRunId",
  "reviewSnapshotId",
  "reviewSnapshotHash",
  "intakeFinalizationId",
  "repositoryIdentityId",
  "applicationContracts",
  "finalSitePort",
]);

export function trustedIntakeContextValid(context) {
  return (
    TRUSTED_INTAKE_CONTEXT_FIELDS.slice(0, 6).every((field) =>
      nonEmpty(context[field]),
    ) &&
    /^[a-f0-9]{64}$/.test(context.reviewSnapshotHash) &&
    Number.isSafeInteger(context.finalSitePort) &&
    context.finalSitePort >= 1024 &&
    context.finalSitePort <= 65_535 &&
    applicationContractsValid(context.applicationContracts)
  );
}

function applicationContractsValid(contracts) {
  if (!Array.isArray(contracts) || contracts.length !== 2) return false;
  const ids = [];
  for (const contract of contracts) {
    if (!exactKeys(contract, ["applicationId", "production", "staging"])) {
      return false;
    }
    if (
      !exactKeys(contract.production, ["id"]) ||
      !exactKeys(contract.staging, ["id"])
    ) {
      return false;
    }
    ids.push(
      contract.applicationId,
      contract.staging.id,
      contract.production.id,
    );
  }
  return ids.every(nonEmpty) && new Set(ids).size === ids.length;
}

function exactKeys(value, keys) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify(keys)
  );
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}
