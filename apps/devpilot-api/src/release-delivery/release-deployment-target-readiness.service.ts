import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { resolveReleaseDeploymentTargetReadiness } from "./release-deployment-target-readiness.model";
import { ReleaseStagingExecutorPort } from "./release-staging.types";

@Injectable()
export class ReleaseDeploymentTargetReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly executor: ReleaseStagingExecutorPort,
  ) {}

  async get(teamId: string, projectId: string, environmentId?: string) {
    const environment = await this.prisma.projectEnvironment.findFirst({
      where: {
        teamId,
        projectId,
        status: "active",
        ...(environmentId
          ? { id: environmentId, baselineRole: { in: ["staging", "production"] } }
          : { baselineRole: "staging" }),
      },
      select: {
        id: true,
        key: true,
        serverBindings: {
          where: { status: "active" },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            metadata: true,
            server: {
              select: {
                id: true,
                name: true,
                host: true,
                port: true,
                username: true,
                authType: true,
                credentials: true,
                status: true,
              },
            },
          },
        },
      },
    });
    const readiness = resolveReleaseDeploymentTargetReadiness(
      environment?.serverBindings ?? [],
      this.executor.providerKey,
    );
    return {
      environmentId: environment?.id ?? null,
      environmentKey: environment?.key ?? null,
      expectedProviderKey: readiness.expectedProviderKey,
      bindingCount: readiness.bindingCount,
      matchState: readiness.matchState,
      reasonCode: readiness.reasonCode,
      remediation: readiness.remediation,
      currentTarget: readiness.currentTarget
        ? {
            bindingId: readiness.currentTarget.binding.id,
            serverId: readiness.currentTarget.binding.server.id,
            providerKey: readiness.expectedProviderKey,
            targetRef: readiness.currentTarget.targetRef,
            root: readiness.currentTarget.root,
            server: {
              id: readiness.currentTarget.binding.server.id,
              name: readiness.currentTarget.binding.server.name,
              host: readiness.currentTarget.binding.server.host,
              status: readiness.currentTarget.binding.server.status,
            },
          }
        : null,
    };
  }
}
