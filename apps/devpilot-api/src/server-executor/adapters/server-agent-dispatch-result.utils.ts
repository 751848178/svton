import { Prisma } from "@prisma/client";
import {
  ServerExecutionInput,
  ServerExecutionResult,
} from "../server-executor.types";
import { toJsonValue } from "./server-agent-dispatch-json.utils";
import {
  buildServerAgentCorrelation,
  buildServerAgentDispatchEnvelope,
  readServerAgentCommandPolicy,
} from "./server-agent-dispatch-plan.utils";
import { redactServerAgentDispatcherUrl } from "./server-agent-dispatch-config.utils";

type AgentDispatchFlags = {
  agentExecutorEnabled: boolean;
  dispatcherConfigured: boolean;
};

export function buildServerAgentCancelledResult(
  input: ServerExecutionInput,
  commandPlan: Prisma.InputJsonValue,
  warnings: string[],
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
      { level: "warn", message: "Server agent dispatch 已在执行前取消。" },
    ]),
    result: toJsonValue({
      mode: "cancelled",
      executed: false,
      executorKey: "server-executor",
      executorAdapterKey: "server-agent",
      adapterKey: input.adapterKey,
      transport: input.target.transport,
      correlation: buildServerAgentCorrelation(input),
    }),
    error: "Server agent dispatch 已取消",
  };
}

export function buildServerAgentDryRunResult(
  input: ServerExecutionInput,
  commandPlan: Prisma.InputJsonValue,
  warnings: string[],
  executable: boolean,
  flags: AgentDispatchFlags,
): ServerExecutionResult {
  const blockedByWarnings =
    input.blockOnWarnings !== false && warnings.length > 0;
  return {
    status: blockedByWarnings ? "blocked" : "completed",
    mode: "dry_run",
    executorKey: "server-executor",
    adapterKey: input.adapterKey,
    executable,
    warnings,
    commandSteps: input.steps,
    commandPlan,
    logs: toJsonValue([
      {
        level: blockedByWarnings ? "warn" : "info",
        message: blockedByWarnings
          ? "Server agent dispatch 计划已生成，但配置不完整，需要补齐后再执行。"
          : "Server agent dispatch dry-run 计划已生成。",
      },
      ...warnings.map((message) => ({ level: "warn", message })),
    ]),
    result: toJsonValue({
      mode: "dry_run",
      executed: false,
      executable,
      executorKey: "server-executor",
      executorAdapterKey: "server-agent",
      adapterKey: input.adapterKey,
      transport: input.target.transport,
      warnings,
      commandPolicy: readServerAgentCommandPolicy(input),
      agentExecutorEnabled: flags.agentExecutorEnabled,
      dispatcherConfigured: flags.dispatcherConfigured,
      correlation: buildServerAgentCorrelation(input),
      dispatchEnvelope: buildServerAgentDispatchEnvelope(input),
      nextExecutorBoundary: "server_agent_dispatcher",
    }),
    error: blockedByWarnings ? warnings.join("；") : undefined,
  };
}

export function buildServerAgentBlockedResult(
  input: ServerExecutionInput,
  commandPlan: Prisma.InputJsonValue,
  warnings: string[],
  reason: string,
  flags: AgentDispatchFlags,
): ServerExecutionResult {
  return {
    status: "blocked",
    mode: "blocked_live_execution",
    executorKey: "server-executor",
    adapterKey: input.adapterKey,
    executable: false,
    warnings: [...warnings, reason],
    commandSteps: input.steps,
    commandPlan,
    logs: toJsonValue([{ level: "warn", message: reason }]),
    result: toJsonValue({
      mode: "blocked_live_execution",
      executed: false,
      executorKey: "server-executor",
      executorAdapterKey: "server-agent",
      adapterKey: input.adapterKey,
      transport: input.target.transport,
      commandPolicy: readServerAgentCommandPolicy(input),
      agentExecutorEnabled: flags.agentExecutorEnabled,
      dispatcherConfigured: flags.dispatcherConfigured,
      correlation: buildServerAgentCorrelation(input),
      dispatchEnvelope: buildServerAgentDispatchEnvelope(input),
      nextExecutorBoundary: "server_agent_dispatcher",
      requiredConfirmationText: input.requiredConfirmationText,
    }),
    error: reason,
  };
}

export function buildServerAgentDispatchFailureResult(
  input: ServerExecutionInput,
  commandPlan: Prisma.InputJsonValue,
  warnings: string[],
  dispatcherUrl: string,
  message: string,
): ServerExecutionResult {
  return {
    status: "failed",
    mode: "executed",
    executorKey: "server-executor",
    adapterKey: input.adapterKey,
    executable: false,
    warnings: [...warnings, message],
    commandSteps: input.steps,
    commandPlan,
    logs: toJsonValue([{ level: "error", message }]),
    result: toJsonValue({
      mode: "agent_dispatch_failed",
      executed: false,
      executorKey: "server-executor",
      executorAdapterKey: "server-agent",
      adapterKey: input.adapterKey,
      transport: input.target.transport,
      commandPolicy: readServerAgentCommandPolicy(input),
      agentExecutorEnabled: true,
      dispatcherConfigured: true,
      dispatcher: redactServerAgentDispatcherUrl(dispatcherUrl),
      correlation: buildServerAgentCorrelation(input),
      dispatchEnvelope: buildServerAgentDispatchEnvelope(input),
    }),
    error: message,
  };
}
