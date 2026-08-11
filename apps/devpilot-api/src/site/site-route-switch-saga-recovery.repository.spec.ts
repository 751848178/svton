import {
  ROUTE_SAGA_MAX_RECOVERY_ATTEMPTS,
  SiteRouteSwitchSagaRecoveryRepository,
} from "./site-route-switch-saga-recovery.repository";

describe("SiteRouteSwitchSagaRecoveryRepository", () => {
  it("selects only stale due work below the retry limit", async () => {
    const prisma = prismaDouble();
    const repository = new SiteRouteSwitchSagaRecoveryRepository(
      prisma as never,
    );
    const now = new Date("2026-08-10T12:00:00.000Z");
    const staleBefore = new Date("2026-08-10T11:59:00.000Z");

    await repository.due(now, staleBefore);

    expect(prisma.siteRouteSwitchRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          recoveryAttemptCount: { lt: ROUTE_SAGA_MAX_RECOVERY_ATTEMPTS },
          updatedAt: { lt: staleBefore },
        }),
        take: 50,
      }),
    );
  });

  it.each(["prepared", "applying"])(
    "persists one operator alert for exhausted %s work",
    async (status) => {
      const updatedAt = new Date("2026-08-10T11:00:00.000Z");
      const prisma = prismaDouble([
        {
          id: `saga-${status}`,
          operationId: `operation-${status}`,
          status,
          lastError: `${status}-error`,
          updatedAt,
          teamId: "team-1",
          projectId: "project-1",
          environmentId: "production-1",
          siteId: "site-1",
          deploymentRunId: "deployment-1",
        },
      ]);
      const repository = new SiteRouteSwitchSagaRecoveryRepository(
        prisma as never,
      );
      const now = new Date("2026-08-10T12:00:00.000Z");

      await expect(repository.alertExhausted(now)).resolves.toEqual([
        expect.objectContaining({ status, operationId: `operation-${status}` }),
      ]);

      expect(prisma.siteRouteSwitchRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: expect.objectContaining({
              in: expect.arrayContaining([status]),
            }),
            recoveryAttemptCount: { gte: ROUTE_SAGA_MAX_RECOVERY_ATTEMPTS },
            alertedAt: null,
          }),
          select: expect.objectContaining({
            teamId: true,
            projectId: true,
            environmentId: true,
            siteId: true,
            deploymentRunId: true,
          }),
        }),
      );
      expect(prisma.siteRouteSwitchRun.updateMany).toHaveBeenCalledWith({
        where: {
          id: `saga-${status}`,
          status,
          recoveryAttemptCount: { gte: ROUTE_SAGA_MAX_RECOVERY_ATTEMPTS },
          alertedAt: null,
          updatedAt,
        },
        data: { alertedAt: now },
      });
    },
  );

  it("does not alert after the selected saga concurrently becomes compensated", async () => {
    const prisma = prismaDouble(
      [
        {
          id: "saga-1",
          operationId: "operation-1",
          status: "applying",
          lastError: "unknown apply result",
          updatedAt: new Date("2026-08-10T11:00:00.000Z"),
        },
      ],
      0,
    );
    const repository = new SiteRouteSwitchSagaRecoveryRepository(
      prisma as never,
    );

    await expect(repository.alertExhausted(new Date())).resolves.toEqual([]);
  });
});

function prismaDouble(rows: unknown[] = [], updateCount = 1) {
  return {
    siteRouteSwitchRun: {
      findMany: jest.fn().mockResolvedValue(rows),
      updateMany: jest.fn().mockResolvedValue({ count: updateCount }),
    },
  };
}
