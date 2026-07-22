import { Prisma } from "@prisma/client";

export type ServerExecutorTransport = "ssh" | "server_agent" | "none";
export type ServerExecutorStatus =
  | "queued"
  | "completed"
  | "failed"
  | "blocked"
  | "cancelled";
export type ServerExecutionMode =
  | "queued"
  | "dry_run"
  | "blocked_live_execution"
  | "executed"
  | "cancelled";
export type ServerCommandPolicyDecisionStatus = "allowed" | "blocked";

export type ServerExecutionCancellationToken = {
  isCancellationRequested(): boolean;
  onCancel(callback: () => void): () => void;
};

export type ServerRemoteExecutionCleanupReason =
  | "cancel"
  | "timeout"
  | "stale_recovery";

export type ServerRemoteExecutionSession = {
  transport: "ssh";
  pid: number;
  observedAt: string;
  serverId?: string | null;
  serverHost?: string;
  operationKey: string;
  adapterKey: string;
  cleanupStrategy: "best_effort_ssh";
};

export type ServerRemoteExecutionCleanup = {
  transport: "ssh";
  pid?: number;
  observedAt: string;
  reason?: ServerRemoteExecutionCleanupReason;
  attempted: boolean;
  succeeded?: boolean;
  error?: string;
};

export type ServerExecutionRuntimeObserver = {
  onRemoteProcessStarted?(
    session: ServerRemoteExecutionSession,
  ): void | Promise<void>;
  onRemoteProcessCleanup?(
    cleanup: ServerRemoteExecutionCleanup,
  ): void | Promise<void>;
};

export type ServerCommandStep = {
  key: string;
  label: string;
  command: string;
  cwd?: string;
  required: boolean;
  risk?: "low" | "medium" | "high";
  timeoutSeconds?: number;
  preview?: string;
  /**
   * Real env values rendered into the heredoc body at execution time only.
   * The persisted `command` carries a redacted mirror; this field is never
   * serialized into `commandPlan`/`logs`/audit `metadata` by the adapters.
   */
  secretEnv?: Record<string, string>;
};

export type ServerExecutorTarget = {
  serverId?: string | null;
  serverName?: string;
  serverHost?: string;
  port?: number;
  username?: string;
  authType?: string;
  transport: ServerExecutorTransport;
  agentRef?: {
    source: "server_services" | "server_tags";
    referenceId: string;
    displayName: string;
    capabilityKey: string;
    status?: string;
    redacted: true;
  };
  credentialRef?: {
    source: "server";
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
  runtimeObserver?: ServerExecutionRuntimeObserver;
};

export type ServerQueuedExecutionOptions = {
  maxAttempts?: number;
  availableAt?: Date;
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
  status: "passed" | "blocked";
  policyKey: string;
  mode: "built_in_baseline" | "built_in_with_templates";
  templateKeys?: string[];
  decisions: ServerCommandPolicyDecision[];
  warnings: string[];
  blockedReasons: string[];
};

export type ServerExecutionResult = {
  status: ServerExecutorStatus;
  mode: ServerExecutionMode;
  executorKey: "server-executor";
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
  queueMode: "queued";
};

export interface ServerExecutorAdapter {
  key: string;
  adapterKey: string;
  transport: ServerExecutorTransport;
  supports(input: ServerExecutionInput): boolean;
  execute(input: ServerExecutionInput): Promise<ServerExecutionResult>;
}
