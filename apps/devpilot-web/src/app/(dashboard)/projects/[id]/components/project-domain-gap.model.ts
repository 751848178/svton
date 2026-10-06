import type { Site } from '@/app/(dashboard)/sites/types';
import type { EnvironmentConfigRevision } from '../types/environment-config-revision.types';
import type { ProjectApplication } from '../types';
import { buildProjectDomainTargets } from './project-domain-workflow.model';

export type ProjectDomainGapFact = {
  key: string;
  source: 'route_revision' | 'active_service';
  domain: string | null;
  component: string | null;
  path: string | null;
  port: number | null;
};

export function buildProjectDomainGapFacts(params: {
  sites: Site[];
  revision: EnvironmentConfigRevision | null;
  applications: ProjectApplication[];
  environmentId: string;
}): ProjectDomainGapFact[] {
  if (params.sites.length > 0) return [];
  const targets = buildProjectDomainTargets(params.applications, params.environmentId);
  const routes = params.revision?.routeSnapshot.entries ?? [];
  if (routes.length > 0) {
    return routes.map((route, index) => {
      const target = targets.find(
        (item) => item.serviceId === route.serviceId && item.port === route.port,
      );
      return {
        key: `route:${route.serviceId ?? route.component}:${route.domain}:${index}`,
        source: 'route_revision',
        domain: route.domain || null,
        component: route.component || target?.component || null,
        path: route.path || null,
        port: route.port ?? target?.port ?? null,
      };
    });
  }
  return targets.map((target) => ({
    key: `service:${target.key}`,
    source: 'active_service',
    domain: null,
    component: target.component,
    path: null,
    port: target.port,
  }));
}
