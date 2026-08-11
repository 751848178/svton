import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { applicationServicePorts } from './application-service-port.utils';

type EnvironmentScope = {
  id: string;
  teamId: string;
  projectId: string;
  baselineRole?: string | null;
};
type RouteEntry = { serviceId?: unknown; component?: unknown; port?: unknown };
export type RouteTargetService = {
  id: string;
  name: string;
  ports: unknown;
  deployConfig: unknown;
};

export async function validateRouteSnapshotTargets(
  tx: Prisma.TransactionClient,
  scope: EnvironmentScope,
  routeSnapshot: Record<string, unknown>,
): Promise<void> {
  const entries = Array.isArray(routeSnapshot.entries)
    ? routeSnapshot.entries as RouteEntry[]
    : [];
  const serviceIds = entries.flatMap((entry) =>
    typeof entry.serviceId === 'string' && entry.serviceId.trim()
      ? [entry.serviceId.trim()]
      : []);
  if (serviceIds.length === 0) {
    const issue = resolveRouteSnapshotTargetIssues(scope, routeSnapshot, [])[0];
    if (issue) throw new BadRequestException(issue.message);
    return;
  }
  const services = await tx.applicationService.findMany({
    where: {
      id: { in: serviceIds },
      teamId: scope.teamId,
      projectId: scope.projectId,
      environmentId: scope.id,
      status: 'active',
    },
    select: { id: true, name: true, ports: true, deployConfig: true },
  });
  const issue = resolveRouteSnapshotTargetIssues(scope, routeSnapshot, services)[0];
  if (issue) throw new BadRequestException(issue.message);
}

export function resolveRouteSnapshotTargetIssues(
  scope: Pick<EnvironmentScope, 'baselineRole'>,
  routeSnapshot: Record<string, unknown>,
  services: RouteTargetService[],
) {
  const entries = Array.isArray(routeSnapshot.entries)
    ? routeSnapshot.entries as RouteEntry[]
    : [];
  return entries.flatMap((entry, index) => {
    if (entry.serviceId == null) {
      return scope.baselineRole === 'staging' || scope.baselineRole === 'production'
        ? [issue('governed_route_service_missing', `治理基线入口 ${index + 1} 必须选择真实服务与持久化端口`)]
        : [];
    }
    if (typeof entry.serviceId !== 'string' || !entry.serviceId.trim()) {
      return [issue('route_service_id_invalid', `入口 ${index + 1} 的 serviceId 无效`)];
    }
    const service = services.find((item) => item.id === entry.serviceId);
    if (!service) {
      return [issue('route_service_scope_invalid', `入口 ${index + 1} 引用了未知或跨环境的服务`)];
    }
    const ports = applicationServicePorts(service.ports, service.deployConfig);
    if (typeof entry.port !== 'number' || !ports.includes(entry.port)) {
      return [issue('route_service_port_invalid', `入口 ${index + 1} 的端口不属于服务 ${service.name} 的已持久化端口`)];
    }
    return entry.component !== service.name
      ? [issue('route_service_name_mismatch', `入口 ${index + 1} 的组件名称与服务 ${service.name} 不匹配`)]
      : [];
  });
}

function issue(code: string, message: string) {
  return { code, message };
}
