import { ConfigService } from "@nestjs/config";
import { ServerExecutionInput } from "../server-executor.types";
import { buildServerAgentCorrelation } from "./server-agent-dispatch-plan.utils";

export function isServerAgentExecutorEnabled(configService: ConfigService) {
  const value = configService.get("SERVER_EXECUTOR_AGENT_ENABLED", "false");
  return value === true || value === "true";
}

export function readServerAgentDispatcherUrl(configService: ConfigService) {
  const value = configService.get("SERVER_EXECUTOR_AGENT_DISPATCHER_URL");
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function readServerAgentDispatcherTimeoutMs(
  configService: ConfigService,
) {
  const configuredSeconds = Number(
    configService.get("SERVER_EXECUTOR_AGENT_DISPATCHER_TIMEOUT_SECONDS", "30"),
  );
  const seconds =
    Number.isFinite(configuredSeconds) && configuredSeconds > 0
      ? configuredSeconds
      : 30;
  return Math.max(1, Math.min(seconds, 300)) * 1000;
}

export function buildServerAgentDispatcherHeaders(
  configService: ConfigService,
  input: ServerExecutionInput,
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-devpilot-team-id": input.teamId,
    "x-devpilot-operation-key": input.operationKey,
  };
  if (input.userId) {
    headers["x-devpilot-actor-id"] = input.userId;
  }
  const correlation = buildServerAgentCorrelation(input);
  if (correlation.serverExecutionJobId) {
    headers["x-devpilot-execution-job-id"] = correlation.serverExecutionJobId;
  }
  if (correlation.serverExecutionLeaseId) {
    headers["x-devpilot-execution-lease-id"] =
      correlation.serverExecutionLeaseId;
  }
  if (correlation.dispatchId) {
    headers["x-devpilot-dispatch-id"] = correlation.dispatchId;
  }
  if (correlation.idempotencyKey) {
    headers["idempotency-key"] = correlation.idempotencyKey;
  }
  const token = configService.get("SERVER_EXECUTOR_AGENT_DISPATCHER_TOKEN");
  if (typeof token === "string" && token.trim()) {
    headers.authorization = `Bearer ${token.trim()}`;
  }
  return headers;
}

export function readServerAgentBlockedReason(
  agentExecutorEnabled: boolean,
  dispatcherConfigured: boolean,
  executable: boolean,
  warnings: string[],
) {
  if (!agentExecutorEnabled) {
    return "Server agent executor 默认关闭，需显式开启并接入 dispatcher 后才能 live 执行";
  }
  if (!dispatcherConfigured) {
    return "Server agent dispatcher 未配置，live agent dispatch 暂不执行";
  }
  if (warnings.length > 0) {
    return warnings.join("；");
  }
  if (!executable) {
    return "Server agent dispatch 计划不可执行，请先补齐配置";
  }
  return undefined;
}

export function redactServerAgentDispatcherUrl(value: string) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "configured";
  }
}
