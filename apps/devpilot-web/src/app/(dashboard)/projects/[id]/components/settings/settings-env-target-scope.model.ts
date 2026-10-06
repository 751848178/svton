import type { ProjectApplication } from '../../types';
import { servicePorts } from './settings-route-target-options.model';

export type EnvironmentTargetComponentScope = {
  serviceId: string;
  label: string;
  ports: number[];
};

export function buildEnvironmentTargetComponentScope(
  applications: ProjectApplication[],
  environmentId: string,
): EnvironmentTargetComponentScope[] {
  return applications.flatMap((application) =>
    application.services
      .filter((service) => service.status === 'active' && service.environment?.id === environmentId)
      .map((service) => ({
        serviceId: service.id,
        label: `${application.name} · ${service.name}`,
        ports: servicePorts(service),
      })),
  );
}
