import type { RepositoryAnalysisRun, RepositoryConnection } from '@prisma/client';
import type { InlineRepositoryCredentialDto } from './dto/repository-connection.dto';

export type RepositoryCredentialMaterial =
  | { kind: 'none'; source: 'none'; label: '公开仓库' }
  | {
      kind: 'https_token';
      source: 'git_connection' | 'team_credential' | 'inline';
      label: string;
      username: string;
      secret: string;
      gitConnectionId?: string;
      teamCredentialId?: string;
    }
  | {
      kind: 'ssh_key';
      source: 'team_credential' | 'inline';
      label: string;
      username?: string;
      secret: string;
      teamCredentialId?: string;
    };

export interface ResolveCredentialInput {
  teamId: string;
  userId: string;
  visibility: 'public' | 'private';
  gitProvider?: string;
  teamCredentialId?: string;
  inlineCredential?: InlineRepositoryCredentialDto;
}

export interface ResolvedRepositoryRef {
  defaultBranch: string;
  selectedBranch: string;
  commitSha: string;
  branches: string[];
}

export interface RepositoryGitFailure {
  code: string;
  message: string;
  action: string;
}

export interface RepositoryCheckout {
  root: string;
  cleanup: () => Promise<void>;
}

export interface RepositoryRunContext {
  run: RepositoryAnalysisRun;
  connection: RepositoryConnection;
  credential: RepositoryCredentialMaterial;
  deadline: number;
}

export interface RepositoryEvidence {
  file: string;
  kind: string;
  detail: string;
  line?: number;
  confidence?: 'high' | 'medium' | 'low';
}

export interface RepositoryCredentialOption {
  id: string;
  source: 'git_connection' | 'team_credential';
  type: 'https_token' | 'ssh_key';
  label: string;
  provider?: string;
}

export interface RepositorySafeError {
  code: string;
  message: string;
  action: string;
}
