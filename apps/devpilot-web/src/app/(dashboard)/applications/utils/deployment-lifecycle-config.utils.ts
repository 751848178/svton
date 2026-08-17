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
    cpuMillicores: requirement(config, 'cpuMillicores'),
    memoryBytes: requirement(config, 'memoryBytes'),
    diskBytes: requirement(config, 'diskBytes'),
  };
}

export function mergeServiceDeploymentConfig(
  current: Record<string, unknown> | null | undefined,
  form: ServiceDeploymentForm,
) {
  const next: Record<string, unknown> = { ...(current || {}) };
  const { cpuMillicores, memoryBytes, diskBytes, ...fields } = form;
  for (const [key, value] of Object.entries(fields)) {
    if (value.trim()) next[key] = value.trim();
    else delete next[key];
  }
  const resources = [cpuMillicores, memoryBytes, diskBytes].map(Number);
  if (resourceRequirementsError(form)) {
    throw new Error('RESOURCE_REQUIREMENTS_INCOMPLETE');
  }
  if (resources.every((value) => Number.isSafeInteger(value) && value > 0)) {
    next.resourceRequirements = {
      cpuMillicores: resources[0], memoryBytes: resources[1], diskBytes: resources[2],
    };
  } else delete next.resourceRequirements;
  return next;
}

export function resourceRequirementsError(form: ServiceDeploymentForm) {
  const values = [form.cpuMillicores, form.memoryBytes, form.diskBytes];
  const present = values.filter((value) => value.trim()).length;
  if (present === 0) return false;
  return present !== values.length || values.some((value) => {
    const number = Number(value);
    return !Number.isSafeInteger(number) || number <= 0;
  });
}

function requirement(config: Record<string, unknown>, key: string) {
  const value = config.resourceRequirements;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const number = (value as Record<string, unknown>)[key];
  return typeof number === 'number' && Number.isSafeInteger(number) ? String(number) : '';
}
