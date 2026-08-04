import type {
  RepositoryIntakeSummary,
  RepositoryIntakeSummarySource,
} from "./repository-intake-summary.types";

const PROJECT_TYPES = new Set([
  "web_application",
  "backend_service",
  "static_site",
  "mixed_application",
]);
const ARCHITECTURES = new Set(["monorepo", "single_repository"]);

export function repositoryIntakeSummary(
  project: RepositoryIntakeSummarySource,
): RepositoryIntakeSummary {
  const decisions = array(
    project.repositoryIntakeReviewSnapshots[0]?.decisions,
  );
  const frozenOverview = decisions
    ?.filter(isAccepted)
    .find((decision) => decision.kind === "project_repository");
  const overview =
    validOverview(
      record(record(frozenOverview?.reviewedValue)?.intakeContract)?.overview,
    ) ??
    validOverview(
      record(record(record(project.config)?.repositoryAnalysis)?.intakeContract)
        ?.overview,
    );

  return {
    projectType: overview?.projectType ?? null,
    architecture: overview?.architecture ?? null,
    componentCount: componentCount(decisions),
  };
}

function componentCount(decisions: Record<string, unknown>[] | null) {
  if (!decisions) return null;
  const components = decisions.filter(
    (decision) =>
      isAccepted(decision) && decision.kind === "application_service",
  );
  const identities = new Set<string>();
  for (const decision of components) {
    const value = record(decision.reviewedValue);
    const contract = record(
      record(record(value)?.metadata)?.repositoryAnalysis,
    )?.intakeContract;
    const component = validComponent(contract);
    if (!component) return null;
    identities.add(`${component.path}\u0000${component.name}`);
  }
  return identities.size;
}

function validOverview(value: unknown) {
  const input = record(value);
  const projectType = string(input?.projectType);
  const architecture = string(input?.architecture);
  if (!projectType || !PROJECT_TYPES.has(projectType)) return null;
  if (!architecture || !ARCHITECTURES.has(architecture)) return null;
  return { projectType, architecture };
}

function validComponent(value: unknown) {
  const input = record(value);
  const name = string(input?.name);
  const path = string(input?.path);
  return name && path ? { name, path } : null;
}

function isAccepted(value: Record<string, unknown>) {
  return value.decision === "accept" || value.decision === "edit";
}

function array(value: unknown): Record<string, unknown>[] | null {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> =>
        Boolean(record(item)),
      )
    : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function string(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}
