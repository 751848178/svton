export type ProjectBaselineRole =
  | "development"
  | "test"
  | "staging"
  | "production";

export interface LegacyRepositorySnapshot {
  id: string;
  provider: string;
  repositoryUrl: string;
  externalRepositoryId?: string | null;
  defaultBranch?: string | null;
  status: string;
  lastAppliedRunId?: string | null;
  appliedAt?: Date | string | null;
}

export interface LegacyEnvironmentSnapshot {
  id: string;
  key: string;
  baselineRole?: string | null;
}

export interface LegacyProjectIntakeSnapshot {
  projectId: string;
  teamId: string;
  gitRepo?: string | null;
  repository?: LegacyRepositorySnapshot | null;
  environments: LegacyEnvironmentSnapshot[];
}

export interface RepositoryIdentityCandidate {
  projectId: string;
  teamId: string;
  repositoryConnectionId: string | null;
  provider: string;
  providerRepositoryId: string | null;
  canonicalKey: string;
  canonicalUrl: string;
  defaultBranch: string | null;
}

export interface RepositoryIdentityCollision {
  teamId: string;
  canonicalKey: string;
  projectIds: string[];
  repositoryConnectionIds: string[];
}

export interface BaselineAssignmentCandidate {
  projectId: string;
  environmentId: string;
  role: ProjectBaselineRole;
}

export interface BaselineAmbiguity {
  projectId: string;
  role: ProjectBaselineRole;
  environmentIds: string[];
  keys: string[];
}

export type LegacyOnboardingRecommendation =
  | "ready"
  | "needs_configuration"
  | null;

export interface LifecycleRecommendation {
  projectId: string;
  suggestedStatus: LegacyOnboardingRecommendation;
  reasons: string[];
}

export interface ProjectIntakeMigrationReport {
  repositoryIdentities: RepositoryIdentityCandidate[];
  repositoryCollisions: RepositoryIdentityCollision[];
  baselineAssignments: BaselineAssignmentCandidate[];
  baselineAmbiguities: BaselineAmbiguity[];
  lifecycleRecommendations: LifecycleRecommendation[];
}
