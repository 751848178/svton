import type { Prisma } from "@prisma/client";

export type RepositoryIdentityTransaction = Prisma.TransactionClient;

export interface RepositoryIdentityCandidate {
  repositoryUrl: string;
  provider: string;
  branch: string;
}

export interface RepositoryIdentityState {
  id: string;
  projectId: string;
  provider: string;
  canonicalKey: string;
  canonicalUrl: string;
  lockedAt: Date | null;
  currentRevision: {
    id: string;
    revision: number;
    defaultBranch: string;
    reason: string;
    createdAt: Date;
    identityId: string;
    projectId: string;
  } | null;
}

export interface VerifiedRepositorySource {
  identityId: string;
  revisionId: string;
  revision: number;
  provider: string;
  canonicalKey: string;
  canonicalUrl: string;
  repositoryUrl: string;
  branch: string;
}

export interface SaveVerifiedConnectionInput {
  teamId: string;
  projectId: string;
  userId: string;
  repositoryUrl: string;
  provider: string;
  visibility: string;
  credentialSource: string;
  gitConnectionId?: string;
  teamCredentialId?: string;
  defaultBranch: string;
  selectedBranch: string;
  commitSha: string;
  branches: string[];
}

export interface SaveFailedConnectionInput {
  teamId: string;
  projectId: string;
  userId: string;
  repositoryUrl: string;
  provider: string;
  visibility: string;
  credentialSource: string;
  gitConnectionId?: string;
  teamCredentialId?: string;
  selectedBranch?: string;
  errorCode: string;
  errorMessage: string;
}
