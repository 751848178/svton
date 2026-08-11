import type { ProjectApplication, ProjectService } from '../../types';

export type SettingsRouteTargetOption = {
  serviceId: string;
  component: string;
  port: number;
};

export function buildSettingsRouteTargetOptions(
  applications: ProjectApplication[],
  environmentId: string,
): SettingsRouteTargetOption[] {
  const options = applications.flatMap((application) =>
    application.services
      .filter((service) => service.status === 'active' && service.environment?.id === environmentId)
      .flatMap((service) => servicePorts(service).map((port) => ({
        serviceId: service.id,
        component: service.name,
        port,
      }))),
  );
  return options.filter((option, index) =>
    options.findIndex((candidate) =>
      candidate.serviceId === option.serviceId && candidate.port === option.port,
    ) === index,
  );
}

export function servicePorts(service: ProjectService): number[] {
  const deployConfig = record(service.deployConfig);
  const candidates = [service.ports, deployConfig.ports, deployConfig.port].flatMap(readPorts);
  return [...new Set(candidates)].sort((left, right) => left - right);
}

function readPorts(value: unknown): number[] {
  if (Array.isArray(value)) return value.flatMap(readPorts);
  if (typeof value === 'number') return validPort(value) ? [value] : [];
  if (typeof value === 'string') {
    const target = Number(value.includes(':') ? value.split(':').at(-1) : value);
    return validPort(target) ? [target] : [];
  }
  if (value && typeof value === 'object') {
    const item = value as Record<string, unknown>;
    return readPorts(item.target ?? item.containerPort ?? item.port);
  }
  return [];
}

function validPort(value: number) {
  return Number.isInteger(value) && value > 0 && value <= 65_535;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
