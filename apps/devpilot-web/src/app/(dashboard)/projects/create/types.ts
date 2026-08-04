export interface ProjectIntakeForm {
  name: string;
  description: string;
  repositoryUrl: string;
  branch: string;
  visibility: 'public' | 'private';
  credentialMode: 'managed' | 'inline';
  teamCredentialId: string;
  credentialType: 'https_token' | 'ssh_key';
  credentialName: string;
  credentialUsername: string;
  credentialSecret: string;
}

export interface ProjectIntakeCredentialOption {
  id: string;
  source: 'git_connection' | 'team_credential';
  type: 'https_token' | 'ssh_key';
  label: string;
  provider?: string;
}

export interface ProjectIntakeProject {
  id: string;
  name: string;
  description: string | null;
  onboardingStatus: string | null;
}

export interface ProjectIntakeConnection {
  id: string;
  provider: string;
  repositoryUrl: string;
  selectedBranch: string | null;
  defaultBranch: string | null;
  commitSha: string | null;
  status: string;
  visibility: string;
  credentialSource: string;
  teamCredentialId: string | null;
  gitConnectionId: string | null;
}

export interface ProjectIntakeSuggestion {
  id: string;
  key: string;
  kind: string;
  confidence: string;
  conflict: boolean;
  impact: string;
  proposedValue: unknown;
  warnings?: string[];
  status: 'pending' | 'applied' | 'rejected';
}

export interface ProjectIntakeRun {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  currentStage?: string | null;
  branch: string;
  commitSha: string;
  summary?: unknown;
  warnings?: string[];
  errorCode?: string | null;
  errorMessage?: string | null;
  errorAction?: string | null;
  suggestions?: ProjectIntakeSuggestion[];
}

export interface ProjectIntakeState {
  project: ProjectIntakeProject;
  repository: { connection: ProjectIntakeConnection | null };
  runs: ProjectIntakeRun[];
}

export interface ProjectIntakeFinalization {
  projectId: string;
  repositoryIdentityId: string;
  reviewSnapshotId: string;
  reviewSnapshotHash: string;
  onboardingRevision: number;
  finalizedAt: string;
  environments: Array<{
    id: string;
    key: 'staging' | 'production';
    baselineRole: 'staging' | 'production';
    configRevisionId: string;
  }>;
}

export type IntakeDecision = 'accept' | 'edit' | 'reject';
export interface IntakeOverviewValue {
  projectType: 'web_application' | 'backend_service' | 'static_site' | 'mixed_application';
  architecture: 'monorepo' | 'single_repository';
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'unknown';
  deploymentPlan: 'container' | 'docker_compose' | 'static_site' | 'process';
}
export interface IntakeComponentValue {
  name: string;
  path: string;
  type: 'frontend_site' | 'backend_service' | 'worker' | 'shared_package' | 'service';
  buildOutput: 'oci_image' | 'static_bundle' | 'runtime_bundle' | 'none';
  runMethod: 'container' | 'static_site' | 'process' | 'worker';
}
export interface RepositoryIntakeContract {
  version: 1;
  run: {
    id: string;
    status: ProjectIntakeRun['status'];
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
  overview: null | {
    suggestionId: string;
    required: true;
    decision: IntakeDecision | null;
    value: IntakeOverviewValue;
  };
  components: Array<{
    suggestionId: string;
    requiredDependencyIds: string[];
    decision: IntakeDecision | null;
    value: IntakeComponentValue;
    warnings: string[];
  }>;
  dependencies: Array<{
    suggestionId: string;
    kind: 'environment' | 'resource_requirement';
    label: string;
    requiredBy: string[];
    decision: IntakeDecision | null;
  }>;
  snapshot: null | {
    id: string;
    version: number;
    hash: string;
    runId: string;
    branch: string;
    commitSha: string;
    parserVersion: string;
    actorId: string | null;
    decidedAt: string;
  };
}
export interface IntakeReviewItem {
  suggestionId: string;
  decision: IntakeDecision;
  overrides?: Partial<IntakeOverviewValue & IntakeComponentValue>;
}

export const INITIAL_INTAKE_FORM: ProjectIntakeForm = {
  name: '',
  description: '',
  repositoryUrl: '',
  branch: '',
  visibility: 'public',
  credentialMode: 'managed',
  teamCredentialId: '',
  credentialType: 'https_token',
  credentialName: '',
  credentialUsername: '',
  credentialSecret: '',
};
