export interface ProjectIntakeForm {
  name: string;
  description: string;
  repositoryUrl: string;
  branch: string;
  visibility: 'public' | 'private';
  credentialType: 'https_token' | 'ssh_key';
  credentialName: string;
  credentialUsername: string;
  credentialSecret: string;
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

export interface ProjectIntakeFinalization {
  projectId: string;
  repositoryIdentityId: string;
  onboardingRevision: number;
  finalizedAt: string;
  environments: Array<{
    id: string;
    key: 'staging' | 'production';
    baselineRole: 'staging' | 'production';
    configRevisionId: string;
  }>;
}

export const INITIAL_INTAKE_FORM: ProjectIntakeForm = {
  name: '',
  description: '',
  repositoryUrl: '',
  branch: '',
  visibility: 'public',
  credentialType: 'https_token',
  credentialName: '',
  credentialUsername: '',
  credentialSecret: '',
};
