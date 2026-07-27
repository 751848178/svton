import type { DeploymentConfig } from "./deployment-command-builders.utils";

export type ProjectConfigRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is ProjectConfigRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string =>
      typeof item === "string" && item.trim().length > 0,
  );
}

function firstString(
  key: string,
  ...sources: ProjectConfigRecord[]
): string | undefined {
  for (const source of sources) {
    const value = readString(source[key]);
    if (value) return value;
  }
  return undefined;
}

export function resolveDeploymentConfig(
  config: ProjectConfigRecord,
  serviceConfigValue?: unknown,
  overrides?: Record<string, unknown>,
): DeploymentConfig {
  const deployment = isRecord(config.deployment) ? config.deployment : {};
  const serviceConfig = isRecord(serviceConfigValue) ? serviceConfigValue : {};
  const stackProfile = isRecord(config.stackProfile) ? config.stackProfile : {};
  const next = isRecord(overrides) ? overrides : {};
  const sources = [next, serviceConfig, deployment];

  return {
    targetType: firstString("targetType", ...sources) ?? "server",
    workingDirectory: firstString("workingDirectory", ...sources),
    buildCommand:
      firstString("buildCommand", ...sources) ??
      readString(stackProfile.buildCommand),
    preStartCheckCommand: firstString("preStartCheckCommand", ...sources),
    migrationCommand: firstString("migrationCommand", ...sources),
    initializationCommand: firstString("initializationCommand", ...sources),
    deployCommand:
      firstString("deployCommand", ...sources) ??
      readString(stackProfile.deployCommand),
    rollbackCommand:
      firstString("rollbackCommand", ...sources) ??
      readString(stackProfile.rollbackCommand),
    healthCheckUrl: firstString("healthCheckUrl", ...sources),
  };
}
