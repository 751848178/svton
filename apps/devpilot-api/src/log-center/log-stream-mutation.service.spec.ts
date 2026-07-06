import { PrismaService } from "../prisma/prisma.service";
import { LogStreamMutationService } from "./log-stream-mutation.service";
import { LogStreamTargetContextService } from "./log-stream-target-context.service";

describe("LogStreamMutationService", () => {
  it("creates streams with resolved target context and JSON metadata", async () => {
    const prisma = {
      logStream: {
        create: jest.fn().mockResolvedValue({ id: "stream-1" }),
      },
    };
    const targetContext = {
      resolve: jest.fn().mockResolvedValue({
        sourceType: "docker",
        projectId: "project-1",
        environmentId: "env-1",
        applicationId: "app-1",
      }),
    };
    const service = new LogStreamMutationService(
      prisma as unknown as PrismaService,
      targetContext as unknown as LogStreamTargetContextService,
    );

    await service.create("team-1", "user-1", {
      name: "app logs",
      labels: { tier: "api" },
      metadata: { redaction: { maskEmails: true } },
    });

    expect(prisma.logStream.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          teamId: "team-1",
          createdById: "user-1",
          projectId: "project-1",
          environmentId: "env-1",
          applicationId: "app-1",
          name: "app logs",
          sourceType: "docker",
          retentionDays: 14,
          labels: { tier: "api" },
          metadata: { redaction: { maskEmails: true } },
        }),
        include: expect.any(Object),
      }),
    );
  });

  it("updates only provided stream fields", async () => {
    const prisma = {
      logStream: {
        update: jest.fn().mockResolvedValue({ id: "stream-1" }),
      },
    };
    const service = new LogStreamMutationService(
      prisma as unknown as PrismaService,
      {} as LogStreamTargetContextService,
    );

    await service.update(
      { id: "stream-1" },
      {
        name: "renamed",
        labels: { owner: "ops" },
        metadata: { follow: true },
      },
    );

    expect(prisma.logStream.update).toHaveBeenCalledWith({
      where: { id: "stream-1" },
      data: {
        name: "renamed",
        labels: { owner: "ops" },
        metadata: { follow: true },
      },
      include: expect.any(Object),
    });
  });
});
