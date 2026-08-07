import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type WorkloadStateClient = Pick<
  Prisma.TransactionClient,
  "artifactManifest" | "projectEnvironment"
>;

const WORKLOAD_SERVICE_SELECT = {
  where: { status: "active", application: { status: "active" } },
  orderBy: { id: "asc" as const },
  select: {
    id: true,
    applicationId: true,
    name: true,
    kind: true,
    deployConfig: true,
  },
} as const;

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
  const environment = await client.projectEnvironment.findFirst({
    where: {
      id: scope.environmentId,
      teamId: scope.teamId,
      projectId: scope.projectId,
      status: "active",
      baselineRole: scope.baselineRole ?? "staging",
    },
    select: {
      id: true,
      applicationServices: WORKLOAD_SERVICE_SELECT,
    },
  });
  if (environment && environment.applicationServices.length === 0) {
    // F455: the Manifest's components are keyed by the project's build
    // services (bound to the active Staging baseline). An environment with no
    // application services of its own (e.g. the Production baseline on the
    // parity stack) deploys the SAME manifest — fall back to the Staging
    // baseline services so the workload service keys match the manifest items
    // (AC-E2E-012/013, one Manifest -> Staging + Production).
    const staging = await client.projectEnvironment.findFirst({
      where: {
        teamId: scope.teamId,
        projectId: scope.projectId,
        status: "active",
        baselineRole: "staging",
      },
      select: { applicationServices: WORKLOAD_SERVICE_SELECT },
    });
    environment.applicationServices =
      staging?.applicationServices ?? [];
  }
  const manifest = await client.artifactManifest.findFirst({
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
  });
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
