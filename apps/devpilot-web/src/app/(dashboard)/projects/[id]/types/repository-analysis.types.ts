export type RepositoryRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface RepositoryCredentialOption {
  id: string;
  source: 'git_connection' | 'team_credential';
  type: 'https_token' | 'ssh_key';
  label: string;
  provider?: string;
}

export interface RepositoryConnection {
  id: string;
  repositoryUrl: string;
  provider: string;
  visibility: 'public' | 'private';
  credentialSource: string;
  defaultBranch?: string | null;
  selectedBranch?: string | null;
  commitSha?: string | null;
  branches?: string[];
  status: 'connected' | 'failed';
  verifiedAt?: string | null;
  appliedAt?: string | null;
  lastAppliedRunId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface RepositoryReadiness {
  connected: boolean;
  analyzed: boolean;
  applied: boolean;
  complete: boolean;
}

export interface RepositoryAnalysisState {
  connection: RepositoryConnection | null;
  credentialOptions: RepositoryCredentialOption[];
  readiness: RepositoryReadiness;
  locked: boolean;
  identityStatus: 'draft' | 'locked' | 'identity_revision_missing' | 'identity_migration_required';
  canonicalIdentity: null | {
    id: string;
    provider: string;
    canonicalUrl: string;
    lockedAt: string | null;
    effectiveRevision: null | {
      id: string;
      revision: number;
      defaultBranch: string;
      reason: string;
      createdAt: string;
    };
  };
  allowedActions: {
    reconnectCredentials: boolean;
    reviseBranch: boolean;
  };
}

export interface ReviseRepositoryBranchInput {
  branch: string;
  reason: string;
  expectedRevision: number;
  idempotencyKey: string;
}

export interface RepositoryEvidence {
  file: string;
  kind: string;
  detail: string;
  confidence?: string;
}

export interface RepositoryAnalysisStage {
  id: string;
  name: string;
  ordinal: number;
  status: RepositoryRunStatus;
  logs?: unknown[];
  evidence?: RepositoryEvidence[];
  errorCode?: string | null;
  errorMessage?: string | null;
  durationMs?: number | null;
}

export interface RepositoryAnalysisSuggestion {
  id: string;
  key: string;
  kind: string;
  confidence: string;
  conflict: boolean;
  impact: string;
  currentValue?: unknown;
  proposedValue: Record<string, unknown>;
  evidence?: RepositoryEvidence[];
  warnings?: string[];
  status: 'pending' | 'applied' | 'rejected';
  reviewDecision?: 'accept' | 'edit' | 'reject' | null;
  reviewedValue?: unknown;
  appliedRefs?: unknown;
}

export interface RepositoryAnalysisRun {
  id: string;
  status: RepositoryRunStatus;
  currentStage?: string | null;
  branch: string;
  commitSha: string;
  parserVersion: string;
  summary?: unknown;
  warnings?: string[];
  errorCode?: string | null;
  errorMessage?: string | null;
  errorAction?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  durationMs?: number | null;
  createdAt: string;
  stages?: RepositoryAnalysisStage[];
  suggestions?: RepositoryAnalysisSuggestion[];
  _count?: { suggestions: number };
}

export interface ConnectRepositoryInput {
  repositoryUrl: string;
  branch?: string;
  visibility: 'public' | 'private';
  gitProvider?: string;
  teamCredentialId?: string;
  credential?: {
    type: 'https_token' | 'ssh_key';
    name: string;
    username?: string;
    secret: string;
  };
}

export type RepositorySuggestionDecision = {
  suggestionId: string;
  decision: 'accept' | 'edit' | 'reject';
  value?: Record<string, unknown>;
};

export interface RepositoryApplyResult {
  complete: boolean;
  appliedAt: string;
  references: Array<{
    suggestionId: string;
    kind: string;
    links: Array<{ label: string; href: string }>;
  }>;
}
