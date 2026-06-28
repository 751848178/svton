import { Prisma } from '@prisma/client';

export type ServerExecutorTransport = 'ssh' | 'server_agent' | 'none';
export type ServerExecutorStatus = 'queued' | 'completed' | 'failed' | 'blocked' | 'cancelled';
export type ServerExecutionMode = 'queued' | 'dry_run' | 'blocked_live_execution' | 'executed' | 'cancelled';
export type ServerCommandPolicyDecisionStatus = 'allowed' | 'blocked';

export type ServerExecutionCancellationToken = {
  isCancellationRequested(): boolean;
  onCancel(callback: () => void): () => void;
};

export type ServerCommandStep = {
  key: string;
  label: string;
  command: string;
  cwd?: string;
  required: boolean;
  risk?: 'low' | 'medium' | 'high';
  timeoutSeconds?: number;
  preview?: string;
};

export type ServerExecutorTarget = {
  serverId?: string | null;
  serverName?: string;
  serverHost?: string;
  port?: number;
  username?: string;
  authType?: string;
  transport: ServerExecutorTransport;
  credentialRef?: {
    source: 'server';
    referenceId: string;
    displayName: string;
    redacted: true;
  };
};

export type ServerExecutionInput = {
  teamId: string;
  userId?: string;
  operationKey: string;
  adapterKey: string;
  dryRun: boolean;
  target: ServerExecutorTarget;
  steps: ServerCommandStep[];
  warnings?: string[];
  metadata?: Record<string, unknown>;
  blockOnWarnings?: boolean;
  requiredConfirmationText?: string;
  confirmationText?: string;
  cancellationToken?: ServerExecutionCancellationToken;
};

export type ServerCommandPolicyDecision = {
  stepKey: string;
  label: string;
  command: string;
  status: ServerCommandPolicyDecisionStatus;
  ruleKey?: string;
  reason: string;
};

export type ServerCommandPolicyResult = {
  status: 'passed' | 'blocked';
  policyKey: string;
  mode: 'built_in_baseline' | 'built_in_with_templates';
  templateKeys?: string[];
  decisions: ServerCommandPolicyDecision[];
  warnings: string[];
  blockedReasons: string[];
};

export type ServerExecutionResult = {
  status: ServerExecutorStatus;
  mode: ServerExecutionMode;
  executorKey: 'server-executor';
  adapterKey: string;
  executable: boolean;
  warnings: string[];
  commandSteps: ServerCommandStep[];
  commandPlan: Prisma.InputJsonValue;
  logs: Prisma.InputJsonValue;
  result: Prisma.InputJsonValue;
  error?: string;
};

export type ServerQueuedExecutionResult = ServerExecutionResult & {
  serverExecutionJobId: string;
  queuedAt: string;
  availableAt: string;
  queueMode: 'queued';
};

export interface ServerExecutorAdapter {
  key: string;
  adapterKey: string;
  transport: ServerExecutorTransport;
  supports(input: ServerExecutionInput): boolean;
  execute(input: ServerExecutionInput): Promise<ServerExecutionResult>;
}
