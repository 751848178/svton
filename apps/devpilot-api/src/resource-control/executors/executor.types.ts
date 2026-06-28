import { Prisma } from '@prisma/client';
import { ResourceActionDefinition } from '../actions/resource-actions';
import { ResolvedCredentialRef } from '../credentials/credential-resolver';

export type ResourceForActionExecution = {
  id: string;
  sourceType: string;
  provider: string;
  kind: string;
  name: string;
  externalId: string;
  endpoint?: string | null;
  config?: Prisma.JsonValue | null;
  metadata?: Prisma.JsonValue | null;
  serverId?: string | null;
  credentialId?: string | null;
};

export type ExecuteResourceActionInput = {
  teamId: string;
  userId?: string | null;
  resource: ResourceForActionExecution;
  action: ResourceActionDefinition;
  credential: ResolvedCredentialRef;
  params: Record<string, unknown>;
  dryRun: boolean;
  queue?: boolean;
  maxAttempts?: number;
  resourceActionRunId?: string;
  operationApprovalId?: string | null;
  confirmationText?: string;
};

export type ResourceActionExecutionResult = {
  status: 'queued' | 'completed' | 'failed' | 'blocked' | 'cancelled';
  serverExecutionJobId?: string;
  commandPlan?: Prisma.InputJsonValue;
  logs?: Prisma.InputJsonValue;
  result?: Prisma.InputJsonValue;
  error?: string;
};

export interface ResourceExecutor {
  key: string;
  adapterKey: string;
  supports(input: ExecuteResourceActionInput): boolean;
  execute(input: ExecuteResourceActionInput): Promise<ResourceActionExecutionResult>;
}
