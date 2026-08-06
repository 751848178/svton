import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type WorkloadStateClient = Pick<
  Prisma.TransactionClient,
  "artifactManifest" | "projectEnvironment"
>;

export interface ReleaseStagingWorkloadScope {
  teamId: string;
  projectId: string;
  environmentId: string;
  manifestId: string;
  baselineRole?: "staging" | "production";
}

export async function loadReleaseStagingWorkloadState(
  client: WorkloadStateClient,
  scope: ReleaseStagingWorkloadScope,
) {
  const [environment, manifest] = await Promise.all([
    client.projectEnvironment.findFirst({
      where: {
        id: scope.environmentId,
        teamId: scope.teamId,
        projectId: scope.projectId,
        status: "active",
        baselineRole: scope.baselineRole ?? "staging",
      },
      select: {
        id: true,
        applicationServices: {
          where: { status: "active", application: { status: "active" } },
          orderBy: { id: "asc" },
          select: {
            id: true,
            applicationId: true,
            name: true,
            kind: true,
            deployConfig: true,
          },
        },
      },
    }),
    client.artifactManifest.findFirst({
      where: {
        id: scope.manifestId,
        teamId: scope.teamId,
        projectId: scope.projectId,
      },
      select: {
        id: true,
        digest: true,
        items: {
          orderBy: { componentKey: "asc" },
          select: {
            componentKey: true,
            digest: true,
            artifactType: true,
            metadata: true,
          },
        },
      },
    }),
  ]);
  return { environment, manifest };
}

@Injectable()
export class ReleaseStagingWorkloadStateRepository {
  constructor(private readonly prisma: PrismaService) {}

  load(scope: ReleaseStagingWorkloadScope) {
    return loadReleaseStagingWorkloadState(this.prisma, scope);
  }
}

export type ReleaseStagingWorkloadState = Awaited<
  ReturnType<typeof loadReleaseStagingWorkloadState>
>;
