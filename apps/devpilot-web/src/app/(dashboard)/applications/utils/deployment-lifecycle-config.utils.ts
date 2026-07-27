import type { ApplicationServiceItem, ServiceDeploymentForm } from '../types';

function readString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

export function readServiceDeploymentForm(
  service?: ApplicationServiceItem | null,
): ServiceDeploymentForm {
  const config = service?.deployConfig || {};
  return {
    workingDirectory: readString(config.workingDirectory),
    buildCommand: readString(config.buildCommand),
    preStartCheckCommand: readString(config.preStartCheckCommand),
    migrationCommand: readString(config.migrationCommand),
    initializationCommand: readString(config.initializationCommand),
    deployCommand: readString(config.deployCommand),
    healthCheckUrl: readString(config.healthCheckUrl),
  };
}

export function mergeServiceDeploymentConfig(
  current: Record<string, unknown> | null | undefined,
  form: ServiceDeploymentForm,
) {
  const next: Record<string, unknown> = { ...(current || {}) };
  for (const [key, value] of Object.entries(form)) {
    if (value.trim()) next[key] = value.trim();
    else delete next[key];
  }
  return next;
}
