import { Prisma } from "@prisma/client";
import { ServerExecutionInput } from "../server-executor.types";
import {
  isRecord,
  readOptionalString,
  readPositiveInteger,
  toJsonValue,
} from "./server-agent-dispatch-json.utils";

export function buildServerAgentCommandPlan(
  input: ServerExecutionInput,
  warnings: string[],
  executable: boolean,
  agentExecutorEnabled: boolean,
  dispatcherConfigured: boolean,
): Prisma.InputJsonValue {
  return toJsonValue({
    executorKey: "server-executor",
    executorAdapterKey: "server-agent",
    adapterKey: input.adapterKey,
    transport: input.target.transport,
    operationKey: input.operationKey,
    dryRun: input.dryRun,
    executable,
    correlation: buildServerAgentCorrelation(input),
    target: buildServerAgentTarget(input),
    safety: {
      arbitraryShell: false,
      commandSource: "server_executor_agent_dispatch_envelope",
      commandPolicy: input.metadata?.commandPolicy,
      secretsInOutput: "must_mask_before_persisting",
      liveExecutionDefault: "blocked_until_server_agent_dispatcher",
    },
    agent: {
      enabled: agentExecutorEnabled,
      dispatcherConfigured,
      requiredCapability: input.adapterKey,
      correlation: buildServerAgentCorrelation(input),
    },
    warnings,
    metadata: input.metadata || {},
    dispatchEnvelope: buildServerAgentDispatchEnvelope(input),
    steps: input.steps,
  });
}

export function buildServerAgentDispatchEnvelope(input: ServerExecutionInput) {
  return {
    operationKey: input.operationKey,
    adapterKey: input.adapterKey,
    teamId: input.teamId,
    actorId: input.userId,
    dryRun: input.dryRun,
    correlation: buildServerAgentCorrelation(input),
    target: buildServerAgentTarget(input),
    stepCount: input.steps.length,
    steps: input.steps.map((step) => ({
      key: step.key,
      label: step.label,
      cwd: step.cwd,
      required: step.required,
      risk: step.risk,
      timeoutSeconds: step.timeoutSeconds,
    })),
    metadata: input.metadata || {},
  };
}

export function buildServerAgentTarget(input: ServerExecutionInput) {
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

export function readServerAgentCommandPolicy(
  input: ServerExecutionInput,
): Prisma.InputJsonValue | undefined {
  return input.metadata?.commandPolicy !== undefined
    ? toJsonValue(input.metadata.commandPolicy)
    : undefined;
}

export function buildServerAgentCorrelation(input: ServerExecutionInput) {
  const metadata = isRecord(input.metadata) ? input.metadata : {};
  const serverExecutionJobId = readOptionalString(
    metadata.serverExecutionJobId,
  );
  const serverExecutionLeaseId = readOptionalString(
    metadata.serverExecutionLeaseId,
  );
  const retryOfJobId = readOptionalString(metadata.retryOfJobId);
  const retryAttempt = readPositiveInteger(metadata.retryAttempt);
  const maxAttempts = readPositiveInteger(metadata.maxAttempts);
  const dispatchId = serverExecutionJobId
    ? `${serverExecutionJobId}:${retryAttempt || 1}`
    : undefined;
  const idempotencyKey = serverExecutionJobId
    ? `server-execution-job:${input.teamId}:${serverExecutionJobId}`
    : undefined;

  return {
    ...(serverExecutionJobId ? { serverExecutionJobId } : {}),
    ...(serverExecutionLeaseId ? { serverExecutionLeaseId } : {}),
    ...(retryOfJobId ? { retryOfJobId } : {}),
    ...(retryAttempt ? { retryAttempt } : {}),
    ...(maxAttempts ? { maxAttempts } : {}),
    ...(dispatchId ? { dispatchId } : {}),
    ...(idempotencyKey ? { idempotencyKey } : {}),
  };
}
