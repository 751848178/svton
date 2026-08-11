import { UnprocessableEntityException } from "@nestjs/common";
import { posix } from "node:path";
import { hashCanonicalReleaseValue } from "./release-canonical-hash.utils";
import type { ReleaseStagingWorkloadState } from "./release-staging-workload-state.repository";
import type {
  ReleaseStagingWorkload,
  ReleaseStagingWorkloadSnapshot,
  ReleaseWorkloadExecutionMode,
} from "./release-staging-workload.types";
import { assertSafeReleaseWorkloadCommand } from "./release-workload-command-policy";
import { applicationServicePorts } from "../project-environment/application-service-port.utils";

const TARGET_LOCAL_HEALTH_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function buildReleaseStagingWorkloadSnapshot(
  state: ReleaseStagingWorkloadState,
  label = "Staging",
): ReleaseStagingWorkloadSnapshot {
  if (!state.environment || !state.manifest) {
    throw new UnprocessableEntityException(
      `${label} 工作负载环境或 Manifest 已漂移`,
    );
  }
  if (state.environment.applicationServices.length === 0) {
    throw new UnprocessableEntityException(`${label} 没有可启动的活动服务`);
  }
  const items = new Map(
    state.manifest.items.map((item) => [item.componentKey, item]),
  );
  const componentKeys = state.environment.applicationServices.map((service) =>
    service.releaseComponentKey ?? service.id);
  const manifestKeys = state.manifest.items
    .map((item) => item.componentKey)
    .filter((key) => key !== "project-bundle");
  if (
    new Set(manifestKeys).size !== manifestKeys.length ||
    new Set(componentKeys).size !== componentKeys.length ||
    [...new Set([...manifestKeys, ...componentKeys])].some((key) =>
      !manifestKeys.includes(key) || !componentKeys.includes(key))
  ) {
    throw new UnprocessableEntityException(
      `${label} 服务拓扑与 exact Manifest 组件集合不一致`,
    );
  }
  const services = state.environment.applicationServices.map((service) => {
    const componentKey = service.releaseComponentKey ?? service.id;
    return workload(service, items.get(componentKey), componentKey);
  });
  const base = {
    version: 1 as const,
    environmentId: state.environment.id,
    manifestId: state.manifest.id,
    manifestDigest: state.manifest.digest,
    services,
  };
  return { ...base, inputHash: hashCanonicalReleaseValue(base) };
}

function workload(
  service: NonNullable<
    ReleaseStagingWorkloadState["environment"]
  >["applicationServices"][number],
  item:
    | NonNullable<ReleaseStagingWorkloadState["manifest"]>["items"][number]
    | undefined,
  componentKey: string,
): ReleaseStagingWorkload {
  if (!/^[A-Za-z0-9_-]+$/.test(service.id)) {
    throw new UnprocessableEntityException("工作负载服务标识无效");
  }
  if (!item || item.artifactType !== "zip") {
    throw new UnprocessableEntityException(
      `服务 ${service.name} 缺少 exact Manifest 组件制品`,
    );
  }
  const config = record(service.deployConfig);
  const startCommand = assertSafeReleaseWorkloadCommand(
    config.deployCommand,
    "启动",
    service.name,
  );
  const executionMode = mode(config.workloadExecutionMode, service.kind);
  const rawStatusCommand = text(config.statusCommand);
  if (executionMode === "managed-command-v1" && !rawStatusCommand) {
    throw new UnprocessableEntityException(
      `服务 ${service.name} 的托管命令模式缺少 statusCommand`,
    );
  }
  const statusCommand = rawStatusCommand
    ? assertSafeReleaseWorkloadCommand(rawStatusCommand, "状态", service.name)
    : undefined;
  const rawFailureCleanupCommand = text(config.failureCleanupCommand);
  if (executionMode === "managed-command-v1" && !rawFailureCleanupCommand) {
    throw new UnprocessableEntityException(
      `服务 ${service.name} 的托管命令模式缺少 failureCleanupCommand`,
    );
  }
  const failureCleanupCommand = rawFailureCleanupCommand
    ? assertSafeReleaseWorkloadCommand(
        rawFailureCleanupCommand,
        "失败清理",
        service.name,
      )
    : undefined;
  const healthCheck = health(config);
  const base = {
    serviceId: service.id,
    applicationId: service.applicationId,
    componentKey,
    name: service.name,
    kind: service.kind,
    ports: applicationServicePorts(service.ports, service.deployConfig),
    artifactDigest: item.digest,
    workingDirectory: workingDirectory(config.workingDirectory),
    executionMode,
    startCommand,
    ...(statusCommand ? { statusCommand } : {}),
    ...(failureCleanupCommand ? { failureCleanupCommand } : {}),
    startTimeoutMs: bounded(config.startTimeoutMs, 120_000, 1_000, 600_000),
    statusTimeoutMs: bounded(config.statusTimeoutMs, 10_000, 500, 60_000),
    ...(healthCheck ? { health: healthCheck } : {}),
  };
  return { ...base, stateHash: hashCanonicalReleaseValue(base) };
}

function mode(value: unknown, kind: string): ReleaseWorkloadExecutionMode {
  if (value === "managed-process-v1" || value === "managed-command-v1") {
    return value;
  }
  return kind === "docker-compose" || kind === "container"
    ? "managed-command-v1"
    : "managed-process-v1";
}

function health(config: Record<string, unknown>) {
  const raw = text(config.healthCheckUrl);
  if (!raw) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnprocessableEntityException("healthCheckUrl 无效");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !TARGET_LOCAL_HEALTH_HOSTS.has(url.hostname.toLowerCase())
  ) {
    throw new UnprocessableEntityException(
      "healthCheckUrl 必须是不含凭据、查询或片段且指向目标机回环地址的 HTTP(S) 地址",
    );
  }
  return {
    url: url.toString(),
    origin: url.origin,
    maxAttempts: bounded(config.healthCheckAttempts, 10, 1, 30),
    intervalMs: bounded(config.healthCheckIntervalMs, 1_000, 0, 30_000),
    timeoutMs: bounded(config.healthCheckTimeoutMs, 5_000, 100, 30_000),
  };
}

function workingDirectory(value: unknown) {
  const raw = text(value) || ".";
  if (raw.includes("\\") || raw.startsWith("/") || /[*?[\]{}!]/.test(raw)) {
    throw new UnprocessableEntityException(
      "工作负载目录必须位于 exact Manifest 内",
    );
  }
  const normalized = posix.normalize(raw).replace(/^\.\//, "");
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new UnprocessableEntityException("工作负载目录不能越过制品根目录");
  }
  return normalized || ".";
}

function bounded(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed)
    ? Math.max(min, Math.min(Math.floor(parsed), max))
    : fallback;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
