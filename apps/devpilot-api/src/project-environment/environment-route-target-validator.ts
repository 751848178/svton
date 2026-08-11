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

export async function validateRouteSnapshotTargets(
  tx: Prisma.TransactionClient,
  scope: EnvironmentScope,
  routeSnapshot: Record<string, unknown>,
): Promise<void> {
  const entries = Array.isArray(routeSnapshot.entries)
    ? routeSnapshot.entries as RouteEntry[]
    : [];
  for (const [index, entry] of entries.entries()) {
    if (entry.serviceId == null) {
      if (scope.baselineRole === 'staging' || scope.baselineRole === 'production') {
        throw new BadRequestException(
          `治理基线入口 ${index + 1} 必须选择真实服务与持久化端口`,
        );
      }
      continue;
    }
    if (typeof entry.serviceId !== 'string' || !entry.serviceId.trim()) {
      throw new BadRequestException(`入口 ${index + 1} 的 serviceId 无效`);
    }
    const service = await tx.applicationService.findFirst({
      where: {
        id: entry.serviceId,
        teamId: scope.teamId,
        projectId: scope.projectId,
        environmentId: scope.id,
        status: 'active',
      },
      select: { id: true, name: true, ports: true, deployConfig: true },
    });
    if (!service) {
      throw new BadRequestException(`入口 ${index + 1} 引用了未知或跨环境的服务`);
    }
    const ports = applicationServicePorts(service.ports, service.deployConfig);
    if (typeof entry.port !== 'number' || !ports.includes(entry.port)) {
      throw new BadRequestException(
        `入口 ${index + 1} 的端口不属于服务 ${service.name} 的已持久化端口`,
      );
    }
    if (entry.component !== service.name) {
      throw new BadRequestException(`入口 ${index + 1} 的组件名称与服务 ${service.name} 不匹配`);
    }
  }
}
