type RevisionJsonFields = {
  plainVariables: unknown;
  secretReferences: unknown;
  resourceReferences: unknown;
  routeSnapshot: unknown;
  policyReferences: unknown;
};

/** Keep legacy JSON nulls from escaping through the revision response schema. */
export function normalizeEnvironmentConfigRevisionList<
  T extends { revisions: RevisionJsonFields[] },
>(response: T) {
  return {
    ...response,
    revisions: response.revisions.map((revision) => ({
      ...revision,
      plainVariables: recordOrEmpty(revision.plainVariables),
      secretReferences: arrayOrEmpty(revision.secretReferences),
      resourceReferences: arrayOrEmpty(revision.resourceReferences),
      routeSnapshot: recordOrEmpty(revision.routeSnapshot),
      policyReferences: arrayOrEmpty(revision.policyReferences),
    })),
  };
}

function arrayOrEmpty(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
