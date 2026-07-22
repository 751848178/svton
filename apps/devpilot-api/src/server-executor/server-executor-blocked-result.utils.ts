import { stripSecretEnv } from "../deployment/deployment-secret-strip.utils";
import {
  ServerCommandPolicyResult,
  ServerExecutionInput,
  ServerExecutionMode,
  ServerExecutionResult,
} from "./server-executor.types";
import { toJsonValue } from "./server-executor-json.utils";
import { buildServerExecutorTargetMetadata } from "./server-executor-result.utils";

export type ServerExecutorBlockingLeaseSnapshot = {
  id: string;
  operationKey: string;
  adapterKey: string;
  acquiredAt: Date;
  expiresAt: Date;
};

export function buildServerExecutorPolicyBlockedResult(
  input: ServerExecutionInput,
  policy: ServerCommandPolicyResult,
): ServerExecutionResult {
  const mode: ServerExecutionMode = input.dryRun
    ? "dry_run"
    : "blocked_live_execution";
  const warnings = [...(input.warnings || []), ...policy.warnings];
  const error = `Server executor 命令策略阻断: ${policy.blockedReasons.join("；")}`;
  // F1: never persist `secretEnv` (plaintext credentials).
  const persistedSteps = stripSecretEnv(input.steps);

  return {
    status: "blocked",
    mode,
    executorKey: "server-executor",
    adapterKey: input.adapterKey,
    executable: false,
    warnings,
    commandSteps: persistedSteps,
    commandPlan: buildPolicyCommandPlan(input, policy, warnings, persistedSteps),
    logs: toJsonValue([{ level: "warn", message: error }]),
    result: toJsonValue({
      mode,
      executed: false,
      executorKey: "server-executor",
      adapterKey: input.adapterKey,
      transport: input.target.transport,
      commandPolicy: policy,
    }),
    error,
  };
}

export function buildServerExecutorConcurrencyBlockedResult(
  input: ServerExecutionInput,
  blockingLease: ServerExecutorBlockingLeaseSnapshot | null,
  blockedLeaseId: string,
): ServerExecutionResult {
  const warning = blockingLease
    ? `目标服务器已有 live 执行正在运行：${blockingLease.operationKey}，请等待释放后重试`
    : "目标服务器已有 live 执行正在运行，请等待释放后重试";
  const warnings = [...(input.warnings || []), warning];
  // F1: never persist `secretEnv` (plaintext credentials).
  const persistedSteps = stripSecretEnv(input.steps);

  return {
    status: "blocked",
    mode: "blocked_live_execution",
    executorKey: "server-executor",
    adapterKey: input.adapterKey,
    executable: false,
    warnings,
    commandSteps: persistedSteps,
    commandPlan: buildConcurrencyCommandPlan(
      input,
      blockingLease,
      blockedLeaseId,
      warnings,
      persistedSteps,
    ),
    logs: toJsonValue([{ level: "warn", message: warning }]),
    result: toJsonValue({
      mode: "blocked_server_execution_lease",
      executed: false,
      executorKey: "server-executor",
      adapterKey: input.adapterKey,
      transport: input.target.transport,
      blockedLeaseId,
      blockingLease,
    }),
    error: warning,
  };
}

function buildPolicyCommandPlan(
  input: ServerExecutionInput,
  policy: ServerCommandPolicyResult,
  warnings: string[],
  steps: ReturnType<typeof stripSecretEnv>,
) {
  return toJsonValue({
    executorKey: "server-executor",
    adapterKey: input.adapterKey,
    transport: input.target.transport,
    operationKey: input.operationKey,
    dryRun: input.dryRun,
    executable: false,
    target: {
      serverId: input.target.serverId,
      serverName: input.target.serverName,
      serverHost: input.target.serverHost,
      port: input.target.port,
      username: input.target.username,
      authType: input.target.authType,
      credentialRef: input.target.credentialRef,
    },
    safety: {
      arbitraryShell: false,
      commandSource: "server_executor_adapter",
      commandPolicy: policy.policyKey,
      liveExecutionDefault: "blocked_unless_policy_passed",
    },
    warnings,
    metadata: input.metadata || {},
    commandPolicy: policy,
    steps,
  });
}

function buildConcurrencyCommandPlan(
  input: ServerExecutionInput,
  blockingLease: ServerExecutorBlockingLeaseSnapshot | null,
  blockedLeaseId: string,
  warnings: string[],
  steps: ReturnType<typeof stripSecretEnv>,
) {
  return toJsonValue({
    executorKey: "server-executor",
    adapterKey: input.adapterKey,
    transport: input.target.transport,
    operationKey: input.operationKey,
    dryRun: input.dryRun,
    executable: false,
    target: buildServerExecutorTargetMetadata(input),
    safety: {
      liveExecutionConcurrency: "one_live_execution_per_server",
      activeLeaseRequired: true,
    },
    serverExecutionLease: {
      mode: "blocked",
      blockedLeaseId,
      blockingLease,
    },
    warnings,
    metadata: input.metadata || {},
    steps,
  });
}
