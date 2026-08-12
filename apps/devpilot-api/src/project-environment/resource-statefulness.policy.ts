const STATELESS_RESOURCE_CATEGORIES = new Set([
  "cdn", "edge", "network", "certificate", "dns",
]);

export function resourceReferenceStateful(input: {
  kind: string;
  resourceKind?: string | null;
  category?: string | null;
}) {
  if (!['managed_resource', 'resource_instance'].includes(input.kind)) {
    return false;
  }
  const category = (input.category ?? input.resourceKind)?.trim().toLowerCase();
  return !category || !STATELESS_RESOURCE_CATEGORIES.has(category);
}
