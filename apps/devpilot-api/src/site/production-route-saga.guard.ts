import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export const ACTIVE_ROUTE_SAGA_STATUSES = [
  "prepared",
  "applying",
  "switched",
  "compensating",
  "compensation_required",
] as const;

export type ProductionRouteSagaScope = {
  teamId: string;
  projectId: string;
  environmentId: string;
};

type Client = PrismaService | Prisma.TransactionClient;

@Injectable()
export class ProductionRouteSagaGuard {
  constructor(private readonly prisma: PrismaService) {}

  assertClear(scope: ProductionRouteSagaScope) {
    return assertNoActiveProductionRouteSaga(this.prisma, scope);
  }
}

export async function lockAndAssertNoActiveProductionRouteSaga(
  tx: Prisma.TransactionClient,
  scope: ProductionRouteSagaScope,
) {
  await tx.$queryRaw`SELECT id FROM ProjectEnvironment
    WHERE id = ${scope.environmentId}
      AND teamId = ${scope.teamId}
      AND projectId = ${scope.projectId}
    FOR UPDATE`;
  return assertNoActiveProductionRouteSaga(tx, scope);
}

export async function assertNoActiveProductionRouteSaga(
  client: Client,
  scope: ProductionRouteSagaScope,
) {
  const active = await client.siteRouteSwitchRun.findFirst({
    where: {
      ...scope,
      status: { in: [...ACTIVE_ROUTE_SAGA_STATUSES] },
    },
    select: { operationId: true, status: true },
  });
  if (active) {
    throw new ConflictException(
      `Production 路由切换 ${active.status} 尚未收敛，禁止发起新发布`,
    );
  }
}
