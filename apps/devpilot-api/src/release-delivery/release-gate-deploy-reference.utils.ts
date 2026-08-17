export type ResourceReference = {
  id: string;
  kind: string;
  stateful?: boolean;
  resourceTypeKey?: string;
};

export function referenceIds(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((item) =>
        item &&
        typeof item === "object" &&
        typeof (item as { id?: unknown }).id === "string"
          ? [(item as { id: string }).id]
          : [],
      )
    : [];
}

export function resourceReferences(value: unknown): ResourceReference[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const reference = item as Record<string, unknown>;
        return typeof reference.id === "string" &&
          typeof reference.kind === "string"
          ? [{
              id: reference.id,
              kind: reference.kind,
              ...(typeof reference.stateful === "boolean"
                ? { stateful: reference.stateful } : {}),
              ...(typeof reference.resourceTypeKey === "string"
                ? { resourceTypeKey: reference.resourceTypeKey } : {}),
            }]
          : [];
      })
    : [];
}
