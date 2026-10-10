import { parsePortMapping } from '../shared/port-mapping.js';

interface ServicePorts { ports?: string[]; healthcheck?: { hostPort?: number } }

/** Explicit health probe port wins over the first published host mapping. */
export function selectedHostPort(spec: ServicePorts): number | undefined {
  return spec.healthcheck?.hostPort || (spec.ports?.[0] ? parsePortMapping(spec.ports[0])?.hostPort : undefined);
}

/** Dynamic published ports are queried using the first container port. */
export function selectedContainerPort(spec: ServicePorts): number | undefined {
  return spec.ports?.[0] ? parsePortMapping(spec.ports[0])?.containerPort : undefined;
}
