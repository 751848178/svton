import type {
  RepositoryIntakeComponentValue,
  RepositoryIntakeOverviewValue,
} from '../repository-analysis/repository-intake-contract.types';

export type RepositoryIntakeDecision = 'accept' | 'edit' | 'reject';

export interface RepositoryIntakeContractReadModel {
  version: 1;
  run: {
    id: string;
    status: string;
    parserVersion: string;
    error?: { code?: string; message?: string; action: string };
    retry: { allowed: boolean; href: string; label: string };
  };
  repository: {
    provider: string;
    repositoryUrl: string;
    visibility: string;
    managedReference: { source: string; id: string } | null;
    defaultBranch: string;
    selectedBranch: string;
    commitSha: string;
    verifiedAt: string | null;
  };
  overview: {
    suggestionId: string;
    required: true;
    decision: RepositoryIntakeDecision | null;
    value: RepositoryIntakeOverviewValue;
  } | null;
  components: Array<{
    suggestionId: string;
    requiredDependencyIds: string[];
    decision: RepositoryIntakeDecision | null;
    value: RepositoryIntakeComponentValue;
    warnings: string[];
  }>;
  dependencies: Array<{
    suggestionId: string;
    kind: 'environment' | 'resource_requirement';
    label: string;
    requiredBy: string[];
    decision: RepositoryIntakeDecision | null;
  }>;
  snapshot: RepositoryIntakeSnapshotReadModel | null;
}

export interface RepositoryIntakeSnapshotReadModel {
  id: string;
  version: number;
  hash: string;
  inputHash: string;
  runId: string;
  branch: string;
  commitSha: string;
  parserVersion: string;
  actorId: string | null;
  decidedAt: string;
  decisions: RepositoryIntakeSnapshotDecision[];
  references: RepositoryIntakeSnapshotReference[];
}

export interface RepositoryIntakeSnapshotDecision {
  suggestionId: string;
  key: string;
  kind: string;
  decision: RepositoryIntakeDecision;
  currentValue: object | null;
  proposedValue: object;
  reviewedValue: object | null;
}

export interface RepositoryIntakeSnapshotReference {
  suggestionId: string;
  kind: string;
  projectId: string;
  environmentId?: string;
  applicationId?: string;
  applicationServiceId?: string;
}
