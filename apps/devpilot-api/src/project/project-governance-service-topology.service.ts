import { ConflictException, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { GovernedBaselineEnvironment } from "./project-governance-finalization.types";

type StructuralService = {
  id: string;
  applicationId: string;
  releaseComponentKey: string | null;
  name: string;
  kind: string;
  runtime: string | null;
  ports: Prisma.JsonValue;
  deployConfig: Prisma.JsonValue;
  metadata: Prisma.JsonValue;
};

@Injectable()
export class ProjectGovernanceServiceTopologyService {
  async materialize(
    tx: Prisma.TransactionClient,
    input: {
      teamId: string;
      projectId: string;
      environments: GovernedBaselineEnvironment[];
    },
  ) {
    const source = await tx.applicationService.findMany({
      where: {
        teamId: input.teamId,
        projectId: input.projectId,
        status: "active",
        releaseComponentKey: { not: null },
        environment: { baselineRole: { in: ["staging", "production"] } },
      },
      select: {
        id: true,
        applicationId: true,
        releaseComponentKey: true,
        name: true,
        kind: true,
        runtime: true,
        ports: true,
        deployConfig: true,
        metadata: true,
      },
      orderBy: { id: "asc" },
    });
    const templates = uniqueTemplates(source);
    for (const environment of input.environments) {
      for (const service of templates) {
        await tx.applicationService.upsert({
          where: {
            environmentId_releaseComponentKey: {
              environmentId: environment.id,
              releaseComponentKey: service.releaseComponentKey as string,
            },
          },
          create: {
            teamId: input.teamId,
            projectId: input.projectId,
            applicationId: service.applicationId,
            environmentId: environment.id,
            releaseComponentKey: service.releaseComponentKey,
            name: service.name,
            kind: service.kind,
            runtime: service.runtime,
            ports: json(service.ports),
            deployConfig: json(service.deployConfig),
            metadata: json(service.metadata),
          },
          update: {
            name: service.name,
            kind: service.kind,
            runtime: service.runtime,
            ports: json(service.ports),
            deployConfig: json(service.deployConfig),
            metadata: json(service.metadata),
          },
        });
      }
    }
  }
}

function uniqueTemplates(services: StructuralService[]) {
  const byKey = new Map<string, StructuralService>();
  for (const service of services) {
    const key = service.releaseComponentKey as string;
    const current = byKey.get(key);
    if (current && contract(current) !== contract(service)) {
      throw new ConflictException(
        `组件 ${key} 在双基线中的结构定义不一致，已拒绝完成治理`,
      );
    }
    byKey.set(key, current ?? service);
  }
  return [...byKey.values()];
}

function contract(service: StructuralService) {
  return JSON.stringify({
    applicationId: service.applicationId,
    name: service.name,
    kind: service.kind,
    runtime: service.runtime,
    ports: service.ports,
    deployConfig: service.deployConfig,
    metadata: service.metadata,
  });
}

function json(value: Prisma.JsonValue): Prisma.InputJsonValue | undefined {
  return value === null ? undefined : (value as Prisma.InputJsonValue);
}
