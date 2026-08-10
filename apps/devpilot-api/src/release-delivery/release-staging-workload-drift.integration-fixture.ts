import type { Prisma, PrismaClient } from "@prisma/client";
import { ReleaseStagingWorkloadService } from "./release-staging-workload.service";

export async function withReleaseStagingWorkloadDrift<T>(
  workloads: ReleaseStagingWorkloadService,
  prisma: PrismaClient,
  serviceId: string,
  action: () => Promise<T>,
) {
  const current = await prisma.applicationService.findUniqueOrThrow({
    where: { id: serviceId },
    select: { deployConfig: true },
  });
  const prepare = workloads.prepare.bind(workloads);
  const spy = jest
    .spyOn(workloads, "prepare")
    .mockImplementationOnce(async (scope) => {
      const snapshot = await prepare(scope);
      await prisma.applicationService.update({
        where: { id: serviceId },
        data: {
          deployConfig: {
            ...record(current.deployConfig),
            statusCommand: "test -e dist/app.txt",
          },
        },
      });
      return snapshot;
    });
  try {
    return await action();
  } finally {
    spy.mockRestore();
    await prisma.applicationService.update({
      where: { id: serviceId },
      data: { deployConfig: current.deployConfig as Prisma.InputJsonValue },
    });
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
