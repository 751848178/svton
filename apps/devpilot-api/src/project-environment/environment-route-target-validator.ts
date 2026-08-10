import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

type EnvironmentScope = { id: string; teamId: string; projectId: string };
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
    if (entry.serviceId == null) continue;
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
    const ports = servicePorts(service.ports, service.deployConfig);
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

function servicePorts(ports: unknown, deployConfig: unknown): number[] {
  const config = record(deployConfig);
  return [...new Set([ports, config.ports, config.port].flatMap(readPorts))];
}

function readPorts(value: unknown): number[] {
  if (Array.isArray(value)) return value.flatMap(readPorts);
  if (typeof value === 'number') return validPort(value) ? [value] : [];
  if (typeof value === 'string') {
    const port = Number(value.includes(':') ? value.split(':').at(-1) : value);
    return validPort(port) ? [port] : [];
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
