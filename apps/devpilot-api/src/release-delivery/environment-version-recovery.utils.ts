import { NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";

export type RecoveryClient = Prisma.TransactionClient | PrismaService;

export interface RecoverySourceVersion {
  id: string;
  artifactManifestId: string;
  releaseOrderId: string;
  releaseRunId: string | null;
  kind: string;
  effectiveAt: Date;
}

export interface RecoveryScope {
  teamId: string;
  projectId: string;
  environmentId: string;
  sourceVersionId: string;
}

export const recoveryRunInclude = {
  operationApproval: {
    select: { id: true, status: true, inputHash: true, requestedAt: true },
  },
  artifactManifest: {
    select: { id: true, digest: true, buildRunId: true },
  },
} as const;

export function recoveryProtection(synthetic: boolean) {
  return {
    changeWindowVerified: synthetic === true,
    freezeVerified: synthetic === true,
  };
}

export function isUniqueConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function resolveRecoverySource(
  client: RecoveryClient,
  input: RecoveryScope,
): Promise<RecoverySourceVersion> {
  const environment = await client.projectEnvironment.findFirst({
    where: {
      id: input.environmentId,
      teamId: input.teamId,
      projectId: input.projectId,
      status: "active",
      baselineRole: "production",
    },
    select: { currentEnvironmentVersionId: true },
  });
  if (!environment) {
    throw new NotFoundException("生产环境不存在或不属于当前项目");
  }
  const source = await client.environmentVersion.findFirst({
    where: {
      id: input.sourceVersionId,
      teamId: input.teamId,
      projectId: input.projectId,
      environmentId: input.environmentId,
    },
    select: {
      id: true,
      artifactManifestId: true,
      releaseOrderId: true,
      releaseRunId: true,
      kind: true,
      effectiveAt: true,
    },
  });
  if (!source) {
    throw new NotFoundException("回退版本不存在或不属于当前环境");
  }
  if (source.id === environment.currentEnvironmentVersionId) {
    throw new UnprocessableEntityException("回退目标不能是当前环境版本");
  }
  return source;
}
