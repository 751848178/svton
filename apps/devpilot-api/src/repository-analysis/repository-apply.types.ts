import type { RepositoryAnalysisSuggestion } from '@prisma/client';
import type { Prisma } from '@prisma/client';

export type RepositoryDecision = {
  suggestion: RepositoryAnalysisSuggestion;
  status: 'accepted' | 'edited' | 'rejected';
  value?: Record<string, unknown>;
};

export type RepositoryAppliedReference = {
  suggestionId: string;
  kind: string;
  projectId: string;
  environmentId?: string;
  applicationId?: string;
  applicationServiceId?: string;
  links: Array<{ label: string; href: string }>;
};

export type RepositoryApplyInput = {
  teamId: string;
  userId: string;
  projectId: string;
  runId: string;
  commitSha: string;
  markConnectionApplied: boolean;
  decisions: RepositoryDecision[];
  snapshot?: { version: number; inputHash: string };
  afterApply?: (tx: Prisma.TransactionClient) => Promise<void>;
};
