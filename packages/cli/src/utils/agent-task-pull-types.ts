export type AgentTaskPullIdentity = {
  teamId: string;
  serverId: string;
  agentId: string;
  runnerId?: string;
  capabilities: string[];
};

export type AgentTaskPullConfig = AgentTaskPullIdentity & {
  apiUrl: string;
  token: string;
  execute: boolean;
  cwd?: string;
  ackRenewalIntervalMs?: number;
  forceKillGraceMs?: number;
};

export type AgentTaskPullCommandStep = {
  key: string;
  label?: string;
  command: string;
  cwd?: string;
  required?: boolean;
  timeoutSeconds?: number;
};

export type AgentTaskPullStepResult = {
  key: string;
  command: string;
  exitCode: number | null;
  durationMs: number;
  stdout: string;
  stderr: string;
  stdoutTruncated?: boolean;
  stderrTruncated?: boolean;
  timedOut: boolean;
  cancelled?: boolean;
  dryRunSkipped?: boolean;
};

export type AgentTaskPullExecutor = (
  step: AgentTaskPullCommandStep,
  options: {
    cwd?: string;
    signal?: AbortSignal;
    forceKillGraceMs?: number;
  },
) => Promise<AgentTaskPullStepResult>;

export type AgentTaskPullTask = {
  available: boolean;
  jobId: string;
  operationKey: string;
  dryRun?: boolean;
  commandSteps: AgentTaskPullCommandStep[];
  lifecycle?: {
    mode?: string;
    ack?: { endpoint?: string };
    finish?: { endpoint?: string };
  };
};

export type AgentTaskPullContractResponse = {
  contract?: {
    mode?: string;
    claimedTaskLifecycleEnvelopeSupported?: boolean;
    lifecycleEnvelope?: { claimResponseField?: string } | null;
  };
};

export type AgentTaskPullClaimResponse = {
  claimed?: boolean;
  reason?: string;
  task?: AgentTaskPullTask;
};

export type AgentTaskPullAckResponse = {
  acked?: boolean;
  reason?: string;
  cancellation?: { shouldStop?: boolean; reason?: string } | null;
};

export type AgentTaskPullRunSummary = {
  mode: "contract_only" | "no_task" | "executed";
  jobId?: string;
  status?: AgentTaskPullFinishStatus;
  stepCount?: number;
  reason?: string;
  finishAccepted?: boolean;
  finishFinished?: boolean;
  finishReason?: string;
};

export type AgentTaskPullFinishStatus = "completed" | "failed" | "cancelled";

export type AgentTaskPullFinishPayload = {
  status: AgentTaskPullFinishStatus;
  commandPlan?: unknown;
  logs?: unknown;
  result?: unknown;
  error?: string;
};

export type AgentTaskPullFinishResponse = {
  accepted?: boolean;
  finished?: boolean;
  reason?: string;
  endpoint?: string;
};

export type AgentTaskPullHttpClient = {
  contract(
    input: AgentTaskPullIdentity,
  ): Promise<AgentTaskPullContractResponse>;
  claim(input: AgentTaskPullIdentity): Promise<AgentTaskPullClaimResponse>;
  ack(
    input: AgentTaskPullIdentity,
    jobId: string,
    progress?: unknown,
  ): Promise<AgentTaskPullAckResponse>;
  finish(
    input: AgentTaskPullIdentity,
    jobId: string,
    payload: AgentTaskPullFinishPayload,
  ): Promise<AgentTaskPullFinishResponse>;
};
