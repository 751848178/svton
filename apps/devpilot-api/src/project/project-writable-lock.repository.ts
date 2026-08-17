import type { Prisma } from "@prisma/client";
import { NotFoundException } from "@nestjs/common";
import { assertProjectWritable } from "./project-archived-write.error";

export async function lockWritableProject(
  tx: Prisma.TransactionClient,
  teamId: string,
  projectId: string,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM Project
    WHERE id = ${projectId} AND teamId = ${teamId}
    FOR UPDATE
  `;
  if (rows.length !== 1) {
    throw new NotFoundException("项目不存在或不属于当前团队");
  }
  const project = await tx.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { archivedAt: true, onboardingStatus: true },
  });
  assertProjectWritable(project);
  return project;
}

export async function lockWritableRunProject(
  tx: Prisma.TransactionClient,
  runId: string,
) {
  const scope = await tx.repositoryAnalysisRun.findUniqueOrThrow({
    where: { id: runId },
    select: { teamId: true, projectId: true },
  });
  return lockWritableScopedRun(tx, scope.teamId, scope.projectId, runId);
}

export async function lockWritableScopedRun(
  tx: Prisma.TransactionClient,
  teamId: string,
  projectId: string,
  runId: string,
) {
  await lockWritableProject(tx, teamId, projectId);
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM RepositoryAnalysisRun
    WHERE id = ${runId} AND teamId = ${teamId} AND projectId = ${projectId}
    FOR UPDATE
  `;
  if (rows.length !== 1) {
    throw new NotFoundException("解析运行不存在或不属于当前项目");
  }
  return tx.repositoryAnalysisRun.findUniqueOrThrow({
    where: { id: runId },
    select: { id: true, teamId: true, projectId: true, status: true },
  });
}
