import { toJsonValue } from "./server-executor-json.utils";
import {
  ServerExecutionInput,
  ServerExecutionResult,
  ServerQueuedExecutionResult,
} from "./server-executor.types";

export type QueuedServerExecutionJobSnapshot = {
  id: string;
  queuedAt: Date;
  availableAt: Date;
};

export function buildServerExecutorCancelledResult(
  input: ServerExecutionInput,
): ServerExecutionResult {
  const warning = "Server executor 执行已取消";

  return {
    status: "cancelled",
    mode: "cancelled",
    executorKey: "server-executor",
    adapterKey: input.adapterKey,
    executable: false,
    warnings: [...(input.warnings || []), warning],
    commandSteps: input.steps,
    commandPlan: toJsonValue({
      executorKey: "server-executor",
      adapterKey: input.adapterKey,
      transport: input.target.transport,
      operationKey: input.operationKey,
      dryRun: input.dryRun,
      executable: false,
      target: buildServerExecutorTargetMetadata(input),
      safety: {
        cancellationRequested: true,
        cancellationSignal: "serverExecutionJob.cancelRequestedAt",
      },
      steps: input.steps,
    }),
    logs: toJsonValue([{ level: "warn", message: warning }]),
    result: toJsonValue({
      mode: "cancelled",
      executed: false,
      executorKey: "server-executor",
      adapterKey: input.adapterKey,
      transport: input.target.transport,
      cancellationSignal: "serverExecutionJob.cancelRequestedAt",
    }),
    error: warning,
  };
}

export function buildServerExecutorQueuedResult(
  input: ServerExecutionInput,
  job: QueuedServerExecutionJobSnapshot,
): ServerQueuedExecutionResult {
  const warning = "Server executor 执行已加入队列";

  return {
    status: "queued",
    mode: "queued",
    executorKey: "server-executor",
    adapterKey: input.adapterKey,
    executable: true,
    warnings: [...(input.warnings || []), warning],
    commandSteps: input.steps,
    commandPlan: toJsonValue({
      executorKey: "server-executor",
      adapterKey: input.adapterKey,
      transport: input.target.transport,
      operationKey: input.operationKey,
      dryRun: input.dryRun,
      executable: true,
      target: buildServerExecutorTargetMetadata(input),
      queue: {
        mode: "queued",
        serverExecutionJobId: job.id,
        queuedAt: job.queuedAt.toISOString(),
        availableAt: job.availableAt.toISOString(),
      },
      safety: {
        queuedBeforeExecution: true,
        commandPolicyEvaluatesWhenClaimed: true,
        liveLeaseAcquiresWhenClaimed: true,
      },
      warnings: [...(input.warnings || []), warning],
      metadata: input.metadata || {},
      steps: input.steps,
    }),
    logs: toJsonValue([{ level: "info", message: warning }]),
    result: toJsonValue({
      mode: "queued",
      executed: false,
      executorKey: "server-executor",
      adapterKey: input.adapterKey,
      transport: input.target.transport,
      serverExecutionJobId: job.id,
      queuedAt: job.queuedAt.toISOString(),
      availableAt: job.availableAt.toISOString(),
    }),
    serverExecutionJobId: job.id,
    queuedAt: job.queuedAt.toISOString(),
    availableAt: job.availableAt.toISOString(),
    queueMode: "queued",
  };
}

export function buildServerExecutorTargetMetadata(input: ServerExecutionInput) {
  return {
    serverId: input.target.serverId,
    serverName: input.target.serverName,
    serverHost: input.target.serverHost,
    port: input.target.port,
    username: input.target.username,
    authType: input.target.authType,
    agentRef: input.target.agentRef,
    credentialRef: input.target.credentialRef,
  };
}
