import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { ReleaseGateDeployEvidence } from "./release-gate-deploy-evidence.types";
import type { ReleaseGatePromoteEvidence } from "./release-gate-promote-evidence.types";
import type { ReleaseGateDecisionTarget } from "./release-gate-decision.types";

export const releaseGateEvidenceSelect = {
  id: true,
  projectId: true,
  releaseVersion: true,
  project: {
    select: {
      repositoryConnection: {
        select: {
          id: true,
          provider: true,
          status: true,
          defaultBranch: true,
          selectedBranch: true,
          commitSha: true,
          verifiedAt: true,
          errorCode: true,
          errorMessage: true,
          updatedAt: true,
        },
      },
      repositoryAnalysisRuns: {
        orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
        take: 1,
        select: {
          id: true,
          status: true,
          branch: true,
          commitSha: true,
          parserVersion: true,
          result: true,
          errorCode: true,
          errorMessage: true,
          finishedAt: true,
          createdAt: true,
        },
      },
    },
  },
  buildRuns: {
    orderBy: [{ revision: "desc" as const }, { id: "desc" as const }],
    take: 1,
    select: {
      id: true,
      revision: true,
      status: true,
      sourceBranch: true,
      sourceCommitSha: true,
      inputSnapshot: true,
      gateSummary: true,
      errorCode: true,
      errorMessage: true,
      startedAt: true,
      finishedAt: true,
      createdAt: true,
      manifest: {
        select: {
          id: true,
          digest: true,
          provenance: true,
          sbom: true,
          signature: true,
          createdAt: true,
          items: {
            orderBy: { componentKey: "asc" as const },
            select: { componentKey: true, digest: true, artifactType: true },
          },
        },
      },
    },
  },
} satisfies Prisma.ReleaseOrderSelect;

export type ReleaseGateEvidenceContext = Prisma.ReleaseOrderGetPayload<{
  select: typeof releaseGateEvidenceSelect;
}> & {
  deploy?: ReleaseGateDeployEvidence;
  promote?: ReleaseGatePromoteEvidence;
  decisionTarget?: ReleaseGateDecisionTarget;
};

@Injectable()
export class ReleaseGateEvidenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  load(
    teamId: string,
    projectId: string,
    releaseOrderId: string,
    buildRunId?: string,
  ) {
    return this.prisma.releaseOrder.findFirst({
      where: { id: releaseOrderId, teamId, projectId },
      select: {
        ...releaseGateEvidenceSelect,
        buildRuns: {
          ...releaseGateEvidenceSelect.buildRuns,
          ...(buildRunId ? { where: { id: buildRunId } } : {}),
        },
      },
    });
  }
}
