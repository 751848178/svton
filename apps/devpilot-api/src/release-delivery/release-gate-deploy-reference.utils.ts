export type ResourceReference = { id: string; kind: string };

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
        const reference = item as { id?: unknown; kind?: unknown };
        return typeof reference.id === "string" &&
          typeof reference.kind === "string"
          ? [{ id: reference.id, kind: reference.kind }]
          : [];
      })
    : [];
}
