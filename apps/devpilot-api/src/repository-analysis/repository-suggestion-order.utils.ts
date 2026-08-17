import type { RepositoryDecision } from "./repository-apply.types";

const SUGGESTION_KIND_ORDER = [
  "environment",
  "project_repository",
  "application_service",
  "resource_requirement",
] as const;

export function orderRepositoryDecisions(
  decisions: RepositoryDecision[],
): RepositoryDecision[] {
  return [...decisions].sort(
    (left, right) =>
      SUGGESTION_KIND_ORDER.indexOf(left.suggestion.kind as never)
      - SUGGESTION_KIND_ORDER.indexOf(right.suggestion.kind as never),
  );
}
