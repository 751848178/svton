type RevisionJsonFields = {
  plainVariables: unknown;
  secretReferences: unknown;
  resourceReferences: unknown;
  routeSnapshot: unknown;
  policyReferences: unknown;
};

type RevisionList = {
  environmentId: string;
  revisions: RevisionJsonFields[];
};

/** Keep legacy JSON nulls from escaping through the revision response schema. */
export function normalizeEnvironmentConfigRevisionList<
  T extends RevisionList,
>(response: T) {
  return {
    ...response,
    revisions: response.revisions.map((revision) => ({
      ...revision,
      plainVariables: recordOrEmpty(revision.plainVariables),
      secretReferences: arrayOrEmpty(revision.secretReferences),
      resourceReferences: normalizeResourceReferences(
        revision.resourceReferences,
        response.environmentId,
      ),
      routeSnapshot: recordOrEmpty(revision.routeSnapshot),
      policyReferences: arrayOrEmpty(revision.policyReferences),
    })),
  };
}

function normalizeResourceReferences(value: unknown, environmentId: string) {
  return arrayOrEmpty(value).map((entry) => {
    const reference = recordOrEmpty(entry);
    return {
      ...reference,
      name: typeof reference.name === "string" ? reference.name : String(reference.id ?? ""),
      sharedEnvironmentIds: Array.isArray(reference.sharedEnvironmentIds)
        ? reference.sharedEnvironmentIds.filter((id): id is string => typeof id === "string")
        : [environmentId],
      risk: ["low", "medium", "high"].includes(String(reference.risk))
        ? reference.risk
        : "medium",
      impact: typeof reference.impact === "string" ? reference.impact : "",
    };
  });
}

function arrayOrEmpty(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
