import { Prisma } from "@prisma/client";
import {
  ServerExecutionInput,
  ServerExecutionResult,
} from "../server-executor.types";
import { toJsonValue, truncateSshOutput } from "./ssh-live-json.utils";
import { SshCommandResult } from "./ssh-live.types";

export function buildSshLivePlan(
  input: ServerExecutionInput,
  warnings: string[],
  executable: boolean,
): Prisma.InputJsonValue {
  return toJsonValue({
    executorKey: "server-executor",
    adapterKey: input.adapterKey,
    transport: "ssh",
    operationKey: input.operationKey,
    dryRun: input.dryRun,
    executable,
    target: {
      serverId: input.target.serverId,
      serverName: input.target.serverName,
      serverHost: input.target.serverHost,
      port: input.target.port,
      username: input.target.username,
      authType: input.target.authType,
      agentRef: input.target.agentRef,
      credentialRef: input.target.credentialRef,
    },
    safety: {
      arbitraryShell: false,
      commandSource: "server_executor_adapter",
      commandPolicy: input.metadata?.commandPolicy,
      secretsInOutput: "masked_before_persisting",
      liveExecutionDefault: "requires_SERVER_EXECUTOR_LIVE_ENABLED",
      remoteProcessTreeKill: "best_effort_ssh_cleanup_on_cancel_or_timeout",
      remoteSupervisor: "temporary_shell_wrapper_until_server_agent",
    },
    warnings,
    metadata: input.metadata || {},
    steps: input.steps,
  });
}

export function buildSshLiveBlockedResult(
  input: ServerExecutionInput,
  commandPlan: Prisma.InputJsonValue,
  warnings: string[],
  error: string,
): ServerExecutionResult {
  return {
    status: "blocked",
    mode: "blocked_live_execution",
    executorKey: "server-executor",
    adapterKey: input.adapterKey,
    executable: false,
    warnings,
    commandSteps: input.steps,
    commandPlan,
    logs: toJsonValue([{ level: "warn", message: error }]),
    result: toJsonValue({
      mode: "blocked_live_execution",
      executorKey: "server-executor",
      adapterKey: input.adapterKey,
      transport: "ssh",
      commandPolicy: input.metadata?.commandPolicy,
    }),
    error,
  };
}

export function buildSshLiveCancelledResult(
  input: ServerExecutionInput,
  commandPlan: Prisma.InputJsonValue,
  warnings: string[],
  result?: SshCommandResult,
): ServerExecutionResult {
  return {
    status: "cancelled",
    mode: "cancelled",
    executorKey: "server-executor",
    adapterKey: input.adapterKey,
    executable: false,
    warnings,
    commandSteps: input.steps,
    commandPlan,
    logs: toJsonValue([
      { level: "warn", message: "SSH live Server executor 执行已取消" },
      {
        level: "info",
        stream: "stdout",
        message: truncateSshOutput(result?.stdout || ""),
      },
      {
        level: result?.stderr ? "warn" : "info",
        stream: "stderr",
        message: truncateSshOutput(result?.stderr || ""),
      },
    ]),
    result: toJsonValue({
      mode: "cancelled",
      executorKey: "server-executor",
      adapterKey: input.adapterKey,
      transport: "ssh",
      commandPolicy: input.metadata?.commandPolicy,
      exitCode: result?.exitCode,
      timedOut: result?.timedOut || false,
      cancelled: true,
      remoteProcessPid: result?.remoteProcessPid,
      remoteKill: result?.remoteKill,
      stdoutPreview: truncateSshOutput(result?.stdout || ""),
      stderrPreview: truncateSshOutput(result?.stderr || ""),
    }),
    error: "SSH live Server executor 执行已取消",
  };
}
