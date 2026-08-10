export const BROWSER_MARKER_GROUPS = freezeGroups({
  releaseDetailEvidence: [
    "twoBuildsStep02",
    "manifestCount2",
    "productionReleaseRuns3",
    "recoveryRunMarked",
    "orderIdShown",
    "upgradeReleaseRunShown",
    "recoveryReleaseRunShown",
    "recoveryApprovalSummary",
  ],
  stagingStepEvidence: [
    "totalStagingDeployments4",
    "twoManifestsListed",
    "manifestOptionListed",
    "productionPrerequisite",
  ],
  envVersionsEvidence: [
    "pageTitle",
    "changeLogTable",
    "stagingUpgradeKind",
    "stagingRecoveryKind",
    "productionUpgradeKind",
    "productionRecoveryKind",
    "currentSuccess",
  ],
  buildLogDrawer: ["opened", "hasBuildRunTitle"],
  stagingRunLog: ["opened", "manifestShown"],
  productionRunLog: ["opened", "recoveryMarked", "approved"],
});

export function browserMarkerGroupsValid(result) {
  return Object.entries(BROWSER_MARKER_GROUPS).every(([groupName, keys]) => {
    const group = result?.[groupName];
    return (
      isPlainObject(group) &&
      keys.every((key) => Object.hasOwn(group, key) && group[key] === true) &&
      Object.values(group).every(
        (value) => typeof value !== "boolean" || value === true,
      )
    );
  });
}

function freezeGroups(groups) {
  for (const keys of Object.values(groups)) Object.freeze(keys);
  return Object.freeze(groups);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
