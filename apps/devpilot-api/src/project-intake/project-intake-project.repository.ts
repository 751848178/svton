import { NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";
import { assertProjectWritable } from "../project/project-archived-write.error";
import { intakeError } from "./project-intake-errors.utils";
import type { ProjectIntakeStatus } from "./project-intake.types";

export async function findProjectIntake(
  prisma: PrismaService,
  teamId: string,
  projectId: string,
) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, teamId },
    select: {
      id: true,
      name: true,
      description: true,
      onboardingStatus: true,
      onboardingRevision: true,
      onboardingFinalizedAt: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!project)
    throw new NotFoundException(
      intakeError(
        "PROJECT_NOT_FOUND",
        "项目不存在",
        "请返回项目接入列表并重新选择。",
      ),
    );
  return project;
}

export async function assertProjectIntakeMutable(
  prisma: PrismaService,
  teamId: string,
  projectId: string,
) {
  const project = await findProjectIntake(prisma, teamId, projectId);
  assertProjectWritable(project);
  return project;
}

export async function transitionProjectIntake(
  prisma: PrismaService | Prisma.TransactionClient,
  teamId: string,
  projectId: string,
  status: ProjectIntakeStatus,
) {
  const current = await prisma.project.findFirst({
    where: { id: projectId, teamId },
    select: { onboardingRevision: true },
  });
  if (!current)
    throw new NotFoundException(
      intakeError(
        "PROJECT_NOT_FOUND",
        "项目不存在",
        "请返回项目接入列表并重新选择。",
      ),
    );
  const result = await prisma.project.updateMany({
    where: {
      id: projectId,
      teamId,
      archivedAt: null,
      onboardingStatus: { notIn: ["ready", "archived"] },
      onboardingRevision: current.onboardingRevision,
    },
    data: {
      onboardingStatus: status,
      onboardingRevision:
        current.onboardingRevision === null ? 1 : { increment: 1 },
    },
  });
  if (result.count !== 1) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, teamId },
      select: { archivedAt: true, onboardingStatus: true },
    });
    if (!project)
      throw new NotFoundException(
        intakeError(
          "PROJECT_NOT_FOUND",
          "项目不存在",
          "请返回项目接入列表并重新选择。",
        ),
      );
    assertProjectWritable(project);
    throw new Error("PROJECT_INTAKE_STATE_TRANSITION_CONFLICT");
  }
}
