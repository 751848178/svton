import type {
  BaselineAmbiguity,
  BaselineAssignmentCandidate,
  LegacyEnvironmentSnapshot,
  LegacyProjectIntakeSnapshot,
  LifecycleRecommendation,
  ProjectBaselineRole,
  ProjectIntakeMigrationReport,
  RepositoryIdentityCandidate,
  RepositoryIdentityCollision,
} from "./project-intake-preflight.types";
import { toRepositoryIdentityCandidate } from "./project-repository-identity.utils";

const BASELINE_ALIASES: Record<ProjectBaselineRole, ReadonlySet<string>> = {
  development: new Set(["dev", "development"]),
  test: new Set(["test", "testing"]),
  staging: new Set(["stage", "staging"]),
  production: new Set(["prod", "production"]),
};

interface BaselineReport {
  assignments: BaselineAssignmentCandidate[];
  ambiguities: BaselineAmbiguity[];
}

function reportRepositoryCollisions(
  identities: RepositoryIdentityCandidate[],
): RepositoryIdentityCollision[] {
  const grouped = new Map<string, RepositoryIdentityCandidate[]>();
  for (const candidate of identities) {
    const groupKey = `${candidate.teamId}\u0000${candidate.canonicalKey}`;
    grouped.set(groupKey, [...(grouped.get(groupKey) ?? []), candidate]);
  }
  return [...grouped.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      teamId: group[0].teamId,
      canonicalKey: group[0].canonicalKey,
      projectIds: group.map((candidate) => candidate.projectId).sort(),
      repositoryConnectionIds: group
        .flatMap((candidate) => candidate.repositoryConnectionId ?? [])
        .sort(),
    }))
    .sort((left, right) => left.canonicalKey.localeCompare(right.canonicalKey));
}

function roleCandidates(
  environments: LegacyEnvironmentSnapshot[],
  role: ProjectBaselineRole,
): LegacyEnvironmentSnapshot[] {
  return environments.filter((environment) => {
    const existingRole = environment.baselineRole?.trim().toLowerCase();
    const key = environment.key.trim().toLowerCase();
    return (
      existingRole === role ||
      (!existingRole && BASELINE_ALIASES[role].has(key))
    );
  });
}

function reportBaselines(project: LegacyProjectIntakeSnapshot): BaselineReport {
  const assignments: BaselineAssignmentCandidate[] = [];
  const ambiguities: BaselineAmbiguity[] = [];
  for (const role of Object.keys(BASELINE_ALIASES) as ProjectBaselineRole[]) {
    const candidates = roleCandidates(project.environments, role);
    if (candidates.length === 1) {
      assignments.push({
        projectId: project.projectId,
        environmentId: candidates[0].id,
        role,
      });
    } else if (candidates.length > 1) {
      ambiguities.push({
        projectId: project.projectId,
        role,
        environmentIds: candidates.map((candidate) => candidate.id).sort(),
        keys: candidates.map((candidate) => candidate.key).sort(),
      });
    }
  }
  return { assignments, ambiguities };
}

function recommendLifecycle(
  project: LegacyProjectIntakeSnapshot,
  repositoryCollision: boolean,
  baseline: BaselineReport,
): LifecycleRecommendation {
  const reasons: string[] = [];
  if (repositoryCollision) reasons.push("repository_identity_collision");
  if (baseline.ambiguities.length > 0) reasons.push("baseline_role_ambiguity");
  if (reasons.length > 0) {
    return {
      projectId: project.projectId,
      suggestedStatus: "needs_configuration",
      reasons,
    };
  }

  const assignedRoles = new Set(
    baseline.assignments.map((assignment) => assignment.role),
  );
  const repository = project.repository;
  const evidenceComplete =
    repository?.status === "connected" &&
    Boolean(repository.lastAppliedRunId) &&
    Boolean(repository.appliedAt);
  if (
    evidenceComplete &&
    assignedRoles.has("staging") &&
    assignedRoles.has("production")
  ) {
    return {
      projectId: project.projectId,
      suggestedStatus: "ready",
      reasons: ["verified_legacy_evidence"],
    };
  }

  return {
    projectId: project.projectId,
    suggestedStatus: null,
    reasons: ["insufficient_legacy_evidence"],
  };
}

export function buildProjectIntakeMigrationReport(
  projects: LegacyProjectIntakeSnapshot[],
): ProjectIntakeMigrationReport {
  const repositoryIdentities = projects.flatMap((project) => {
    const identity = toRepositoryIdentityCandidate(project);
    return identity ? [identity] : [];
  });
  const repositoryCollisions = reportRepositoryCollisions(repositoryIdentities);
  const collisionProjects = new Set(
    repositoryCollisions.flatMap((collision) => collision.projectIds),
  );
  const baselineReports = new Map(
    projects.map((project) => [project.projectId, reportBaselines(project)]),
  );

  return {
    repositoryIdentities,
    repositoryCollisions,
    baselineAssignments: [...baselineReports.values()].flatMap(
      (report) => report.assignments,
    ),
    baselineAmbiguities: [...baselineReports.values()].flatMap(
      (report) => report.ambiguities,
    ),
    lifecycleRecommendations: projects.map((project) =>
      recommendLifecycle(
        project,
        collisionProjects.has(project.projectId),
        baselineReports.get(project.projectId) ?? {
          assignments: [],
          ambiguities: [],
        },
      ),
    ),
  };
}
