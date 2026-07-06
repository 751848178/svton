import { BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { LogStreamLinkedTargetContextService } from "./log-stream-linked-target-context.service";
import { LogStreamSourceTargetContextService } from "./log-stream-source-target-context.service";
import { LogStreamTargetContextService } from "./log-stream-target-context.service";

describe("LogStreamTargetContextService", () => {
  it("resolves application service targets through the linked-target service", async () => {
    const prisma = {
      applicationService: {
        findFirst: jest.fn().mockResolvedValue({
          id: "svc-1",
          projectId: "project-1",
          applicationId: "app-1",
          environmentId: "env-1",
          serverId: "server-1",
          siteId: "site-1",
          managedResourceId: "resource-1",
        }),
      },
    };
    const service = new LogStreamLinkedTargetContextService(
      prisma as unknown as PrismaService,
    );

    await expect(
      service.resolve("team-1", {
        name: "app logs",
        applicationServiceId: "svc-1",
      }),
    ).resolves.toEqual({
      sourceType: "docker",
      projectId: "project-1",
      applicationId: "app-1",
      environmentId: "env-1",
      applicationServiceId: "svc-1",
      serverId: "server-1",
      siteId: "site-1",
      managedResourceId: "resource-1",
    });
  });

  it("maps Aliyun SLS managed resources to the sls source type", async () => {
    const prisma = {
      managedResource: {
        findFirst: jest.fn().mockResolvedValue({
          id: "resource-1",
          projectId: "project-1",
          environmentId: "env-1",
          serverId: null,
          provider: "aliyun-sls",
          kind: "log_service",
        }),
      },
    };
    const service = new LogStreamSourceTargetContextService(
      prisma as unknown as PrismaService,
    );

    await expect(
      service.resolve("team-1", {
        name: "sls logs",
        managedResourceId: "resource-1",
      }),
    ).resolves.toEqual({
      sourceType: "sls",
      managedResourceId: "resource-1",
      projectId: "project-1",
      environmentId: "env-1",
      serverId: null,
    });
  });

  it("keeps loose project and environment scope validation intact", async () => {
    const prisma = {
      project: {
        findFirst: jest.fn().mockResolvedValue({ id: "project-1" }),
      },
      projectEnvironment: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: "env-2", projectId: "project-2" }),
      },
    };
    const service = new LogStreamSourceTargetContextService(
      prisma as unknown as PrismaService,
    );

    await expect(
      service.resolve("team-1", {
        name: "manual logs",
        projectId: "project-1",
        environmentId: "env-2",
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("falls through to source targets when no linked target id is present", async () => {
    const linkedTargets = {
      resolve: jest.fn().mockResolvedValue(null),
    };
    const sourceTargets = {
      resolve: jest.fn().mockResolvedValue({
        sourceType: "manual",
        projectId: "project-1",
        environmentId: "env-1",
      }),
    };
    const service = new LogStreamTargetContextService(
      linkedTargets as unknown as LogStreamLinkedTargetContextService,
      sourceTargets as unknown as LogStreamSourceTargetContextService,
    );

    await expect(
      service.resolve("team-1", {
        name: "manual logs",
        projectId: "project-1",
        environmentId: "env-1",
      }),
    ).resolves.toEqual({
      sourceType: "manual",
      projectId: "project-1",
      environmentId: "env-1",
    });
    expect(sourceTargets.resolve).toHaveBeenCalled();
  });
});
