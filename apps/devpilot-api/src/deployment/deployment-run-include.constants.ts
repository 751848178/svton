/**
 * DeploymentRun 对外读取关系。
 *
 * 单一职责：集中维护部署运行列表/详情的安全关联字段及发布计划回链。
 */
import { Prisma } from "@prisma/client";

export const DEPLOYMENT_RUN_INCLUDE = {
  project: { select: { id: true, name: true } },
  projectEnvironment: {
    select: { id: true, key: true, name: true, status: true },
  },
  application: { select: { id: true, name: true, status: true } },
  applicationService: {
    select: {
      id: true,
      name: true,
      kind: true,
      runtime: true,
      status: true,
      environment: {
        select: { id: true, key: true, name: true, status: true },
      },
    },
  },
  actor: { select: { id: true, name: true, email: true } },
  server: { select: { id: true, name: true, host: true } },
  operationApproval: {
    select: {
      id: true,
      status: true,
      risk: true,
      reviewedAt: true,
      consumedAt: true,
    },
  },
  sourceRun: {
    select: {
      id: true,
      mode: true,
      status: true,
      branch: true,
      commitSha: true,
      startedAt: true,
    },
  },
  serverExecutionJob: {
    select: {
      id: true,
      status: true,
      queueMode: true,
      attempt: true,
      maxAttempts: true,
      queuedAt: true,
      startedAt: true,
      finishedAt: true,
    },
  },
  releaseStageAttempts: {
    take: 1,
    select: {
      id: true,
      releaseStage: {
        select: {
          id: true,
          name: true,
          releasePlan: { select: { id: true, name: true, status: true } },
        },
      },
    },
  },
} satisfies Prisma.DeploymentRunInclude;
