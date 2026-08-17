import type {
  DetectedCommandSet,
  DetectedService,
} from "./repository-parser.types";

export type RepositoryWorkloadContract = {
  kind: string;
  targetType: string;
  workloadExecutionMode?: "managed-command-v1" | "managed-process-v1";
  deployCommand?: string;
  statusCommand?: string;
  failureCleanupCommand?: string;
  healthCheckUrl?: string;
};

export function repositoryWorkloadContract(
  service: DetectedService,
  commands: DetectedCommandSet,
): RepositoryWorkloadContract {
  const deployCommand = text(commands.start);
  if (!deployCommand) return {
    kind: service.container.composeFiles.length ? "docker-compose" : "container",
    targetType: service.container.composeFiles.length ? "docker-compose" : "server",
  };
  const statusCommand = text(commands.status);
  const failureCleanupCommand = text(commands.cleanup);
  const managedCommand = Boolean(statusCommand && failureCleanupCommand);
  return {
    kind: managedCommand ? "docker-compose" : "container",
    targetType: managedCommand ? "docker-compose" : "server",
    workloadExecutionMode: managedCommand
      ? "managed-command-v1" as const
      : "managed-process-v1" as const,
    deployCommand,
    ...(managedCommand ? { statusCommand, failureCleanupCommand } : {}),
    ...(healthCheckUrl(service) ? { healthCheckUrl: healthCheckUrl(service) } : {}),
  };
}

export function healthCheckUrl(service: DetectedService) {
  const ports = [...new Set(service.ports)].filter((port) =>
    Number.isInteger(port) && port > 0 && port <= 65_535);
  const path = service.healthChecks[0]?.path?.trim();
  if (ports.length !== 1 || !path?.startsWith("/") || path.startsWith("//")) {
    return undefined;
  }
  try {
    const url = new URL(path, `http://127.0.0.1:${ports[0]}`);
    return url.hostname === "127.0.0.1" && !url.username && !url.password &&
      !url.search && !url.hash
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
