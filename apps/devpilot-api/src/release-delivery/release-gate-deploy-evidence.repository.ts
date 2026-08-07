import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { ReleaseGateDeployEvidence } from "./release-gate-deploy-evidence.types";
import { ReleaseGateDeployOperationEvidenceRepository } from "./release-gate-deploy-operation-evidence.repository";
import {
  referenceIds,
  resourceReferences,
} from "./release-gate-deploy-reference.utils";
import { ReleaseGateDeployResourceEvidenceRepository } from "./release-gate-deploy-resource-evidence.repository";

@Injectable()
export class ReleaseGateDeployEvidenceRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resources: ReleaseGateDeployResourceEvidenceRepository,
    private readonly operations: ReleaseGateDeployOperationEvidenceRepository,
  ) {}

  async load(
    teamId: string,
    projectId: string,
    releaseOrderId: string,
    manifestId?: string,
    environmentId?: string,
    configRevisionId?: string | null,
    deploymentRunId?: string,
  ): Promise<ReleaseGateDeployEvidence> {
    const environment = await this.prisma.projectEnvironment.findFirst({
      where: {
        teamId,
        projectId,
        status: "active",
        ...(environmentId
          ? { id: environmentId }
          : { baselineRole: "staging" }),
        ...(configRevisionId !== undefined
          ? { currentConfigRevisionId: configRevisionId }
          : {}),
      },
      select: {
        id: true,
        key: true,
        status: true,
        baselineRole: true,
        currentConfigRevision: {
          select: {
            id: true,
            projectId: true,
            environmentId: true,
            revision: true,
            snapshotHash: true,
            plainVariables: true,
            secretReferences: true,
            resourceReferences: true,
            routeSnapshot: true,
            policyReferences: true,
            createdAt: true,
          },
        },
        serverBindings: {
          where: { status: "active" },
          select: {
            id: true,
            status: true,
            metadata: true,
            updatedAt: true,
            server: {
              select: {
                id: true,
                status: true,
                host: true,
                port: true,
                username: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    });
    if (!environment) return emptyDeployEvidence();
    const references = resourceReferences(
      environment.currentConfigRevision?.resourceReferences,
    );
    const managedIds = references
      .filter((item) => item.kind === "managed_resource")
      .map((item) => item.id);
    const [resourceEvidence, operationEvidence] = await Promise.all([
      this.resources.load({
        teamId,
        projectId,
        environmentId: environment.id,
        secretIds: referenceIds(
          environment.currentConfigRevision?.secretReferences,
        ),
        references,
      }),
      this.operations.load({
        teamId,
        projectId,
        releaseOrderId,
        environmentId: environment.id,
        manifestId,
        deploymentRunId,
        skipDeployments: Boolean(environmentId && !deploymentRunId),
        managedResourceIds: managedIds,
      }),
    ]);
    return { environment, ...resourceEvidence, ...operationEvidence };
  }
}

function emptyDeployEvidence(): ReleaseGateDeployEvidence {
  return {
    environment: null,
    secrets: [],
    resources: [],
    deployments: [],
    connections: [],
    metrics: [],
    backups: [],
  };
}
