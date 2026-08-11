import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";
import type { ReleaseDeploymentInputState } from "./release-deployment-input.types";
import {
  deploymentSecretReferences,
  deploymentResourceReferences,
} from "./release-deployment-input-reference.utils";
import {
  loadReleaseDeploymentResources,
  type ReleaseDeploymentResourceDb,
} from "./release-deployment-resource-state.repository";

type InputDb = Pick<
  Prisma.TransactionClient,
  "projectEnvironment" | "environmentConfigRevision" | "secretKey"
> &
  ReleaseDeploymentResourceDb;

export async function loadReleaseDeploymentInputState(
  database: PrismaService | Prisma.TransactionClient,
  input: {
    teamId: string;
    projectId: string;
    environmentId: string;
    configRevisionId?: string;
    label?: string;
  },
): Promise<ReleaseDeploymentInputState> {
  const db = database as unknown as InputDb;
  const label = input.label ?? "Staging";
  const environment = await db.projectEnvironment.findFirst({
    where: {
      id: input.environmentId,
      teamId: input.teamId,
      projectId: input.projectId,
      status: "active",
    },
    select: {
      id: true,
      currentConfigRevision: {
        select: {
          id: true,
          teamId: true,
          projectId: true,
          environmentId: true,
          revision: true,
          snapshotHash: true,
          plainVariables: true,
          secretReferences: true,
          resourceReferences: true,
          routeSnapshot: true,
        },
      },
      serverBindings: {
        where: {
          status: "active",
          teamId: input.teamId,
          projectId: input.projectId,
          server: { teamId: input.teamId },
        },
        select: {
          id: true,
          teamId: true,
          projectId: true,
          environmentId: true,
          metadata: true,
          updatedAt: true,
          server: {
            select: {
              id: true,
              teamId: true,
              host: true,
              port: true,
              username: true,
              authType: true,
              credentials: true,
              status: true,
              updatedAt: true,
            },
          },
        },
      },
    },
  });
  if (!environment) {
    throw new ConflictException(`${label} 环境不存在或已停用`);
  }
  const revision = input.configRevisionId
    ? await db.environmentConfigRevision.findFirst({
        where: {
          id: input.configRevisionId,
          teamId: input.teamId,
          projectId: input.projectId,
          environmentId: input.environmentId,
        },
      })
    : environment.currentConfigRevision;
  if (!revision) {
    throw new ConflictException(
      input.configRevisionId
        ? "冻结配置修订已不存在或作用域漂移"
        : `${label} 环境缺少当前配置修订`,
    );
  }
  if (
    revision.teamId !== input.teamId ||
    revision.projectId !== input.projectId ||
    revision.environmentId !== input.environmentId
  ) {
    throw new ConflictException(`${label} 配置修订作用域与环境不一致`);
  }
  if (
    environment.serverBindings.some(
      (binding) =>
        binding.teamId !== input.teamId ||
        binding.projectId !== input.projectId ||
        binding.environmentId !== input.environmentId ||
        binding.server.teamId !== input.teamId,
    )
  ) {
    throw new ConflictException(`部署目标绑定作用域与 ${label} 环境不一致`);
  }
  const rawSecrets = revision.secretReferences;
  const secretReferences = deploymentSecretReferences(rawSecrets);
  const secretIds = secretReferences.map((item) => item.id);
  const references = deploymentResourceReferences(revision.resourceReferences);
  const rawReferences = revision.resourceReferences;
  if (
    !completeReferenceArray(rawSecrets, secretIds.length) ||
    !completeReferenceArray(rawReferences, references.length) ||
    references.some(
      (reference) =>
        !reference.sharedEnvironmentIds.includes(input.environmentId),
    )
  ) {
    throw new ConflictException("部署配置引用格式无效或未绑定当前环境");
  }
  const sharedEnvironmentIds = [
    ...new Set(references.flatMap((item) => item.sharedEnvironmentIds)),
  ];
  const sharedEnvironments = await db.projectEnvironment.findMany({
    where: {
      id: { in: sharedEnvironmentIds },
      teamId: input.teamId,
      projectId: input.projectId,
      status: "active",
    },
    select: { id: true },
  });
  if (sharedEnvironments.length !== sharedEnvironmentIds.length) {
    throw new ConflictException("部署资源共享环境作用域已漂移");
  }
  const [secrets, resources] = await Promise.all([
    db.secretKey.findMany({
      where: {
        id: { in: secretIds },
        teamId: input.teamId,
        OR: [{ projectId: null }, { projectId: input.projectId }],
        AND: [
          {
            OR: [
              { environmentId: null },
              { environmentId: input.environmentId },
            ],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        type: true,
        value: true,
        updatedAt: true,
      },
    }),
    loadReleaseDeploymentResources(db, input, references),
  ]);
  if (
    secrets.length !== secretIds.length ||
    resources.length !== references.length
  ) {
    throw new ConflictException("部署配置引用已漂移，请创建新快照");
  }
  return {
    environmentId: environment.id,
    revision,
    secrets: secrets.map((secret) => ({
      ...secret,
      targetEnvKey: secretReferences.find((reference) => reference.id === secret.id)?.targetEnvKey,
    })),
    resources,
    bindings: environment.serverBindings,
  };
}

function completeReferenceArray(value: unknown, parsedCount: number) {
  return value == null || (Array.isArray(value) && value.length === parsedCount);
}
