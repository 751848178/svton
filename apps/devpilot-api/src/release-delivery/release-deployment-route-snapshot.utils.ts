import { ConflictException } from "@nestjs/common";
import type { ReleaseStagingWorkloadSnapshot } from "./release-staging-workload.types";

export type FrozenRouteTarget = {
  serviceId: string;
  component: string;
  port: number;
};

export function frozenRouteTargets(value: unknown): FrozenRouteTarget[] {
  const route = record(value);
  if (!Array.isArray(route.entries)) return [];
  return route.entries.flatMap((entry) => {
    const item = record(entry);
    return typeof item.serviceId === "string" &&
      typeof item.component === "string" &&
      typeof item.port === "number"
      ? [{
          serviceId: item.serviceId,
          component: item.component,
          port: item.port,
        }]
      : [];
  });
}

export function assertFrozenRoutesMatchWorkload(
  routes: FrozenRouteTarget[],
  workload: ReleaseStagingWorkloadSnapshot,
) {
  for (const route of routes) {
    const service = workload.services.find((item) => item.serviceId === route.serviceId);
    if (!service) {
      throw new ConflictException(
        `冻结入口服务 ${route.serviceId} 已归档或不属于当前工作负载`,
      );
    }
    if (
      service.name !== route.component ||
      !(service.ports ?? []).includes(route.port)
    ) {
      throw new ConflictException(
        `冻结入口 ${route.component}:${route.port} 已与服务定义漂移`,
      );
    }
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
