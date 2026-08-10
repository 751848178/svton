export function requireFirstEnvironmentRevision(response) {
  if (
    !response ||
    typeof response !== "object" ||
    !Array.isArray(response.revisions)
  ) {
    throw new Error("PARITY_ENVIRONMENT_REVISION_LIST_INVALID: schema");
  }
  const first = response.revisions.find(({ revision }) => revision === 1);
  if (!first || typeof first.id !== "string" || first.id.length === 0) {
    throw new Error("PARITY_ENVIRONMENT_REVISION_LIST_INVALID: revision-one");
  }
  return first;
}
