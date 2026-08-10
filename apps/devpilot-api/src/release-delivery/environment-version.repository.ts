import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  reserveEnvironmentVersionAction,
  type EnvironmentVersionActionReservationInput,
} from "./environment-version-action-reservation.repository";
import { replayEnvironmentVersionAction } from "./environment-version-action-replay.repository";

@Injectable()
export class EnvironmentVersionRepository {
  constructor(private readonly prisma: PrismaService) {}

  environment(teamId: string, projectId: string, environmentId: string) {
    return this.prisma.projectEnvironment.findFirst({
      where: {
        id: environmentId,
        teamId,
        projectId,
        status: "active",
        baselineRole: { in: ["staging", "production"] },
      },
      select: {
        id: true,
        key: true,
        name: true,
        baselineRole: true,
        currentConfigRevisionId: true,
        currentEnvironmentVersionId: true,
      },
    });
  }

  sourceVersion(
    teamId: string,
    projectId: string,
    environmentId: string,
    versionId: string,
  ) {
    return this.prisma.environmentVersion.findFirst({
      where: { id: versionId, teamId, projectId, environmentId },
      select: { id: true, artifactManifestId: true },
    });
  }

  manifest(teamId: string, projectId: string, manifestId: string) {
    return this.prisma.artifactManifest.findFirst({
      where: { id: manifestId, teamId, projectId },
      include: {
        buildRun: {
          select: {
            id: true,
            status: true,
            sourceBranch: true,
            sourceCommitSha: true,
          },
        },
        items: true,
        deploymentRuns: {
          where: {
            source: "release_order",
            status: "completed",
            projectEnvironment: { baselineRole: "staging" },
          },
          select: { id: true, result: true },
        },
      },
    });
  }

  releaseRun(
    teamId: string,
    projectId: string,
    environmentId: string,
    runId: string,
  ) {
    return this.prisma.releaseRun.findFirst({
      where: { id: runId, teamId, projectId, environmentId },
      select: {
        id: true,
        mode: true,
        status: true,
        artifactManifestId: true,
        verifiedDigest: true,
        configRevisionId: true,
        inputHash: true,
        resourceSnapshot: true,
        routeSnapshot: true,
        policySnapshot: true,
        operationApproval: true,
        environment: { select: { currentConfigRevisionId: true } },
      },
    });
  }

  recoverySourceVersionId(
    teamId: string,
    projectId: string,
    environmentId: string,
    releaseRunId: string,
  ) {
    return this.prisma.$queryRaw<Array<{ sourceVersionId: string | null }>>`
      SELECT rv.id AS sourceVersionId
      FROM EnvironmentVersion rv
      INNER JOIN ReleaseRun rr ON rr.sourceReleaseRunId = rv.releaseRunId
      WHERE rr.id = ${releaseRunId}
        AND rr.teamId = ${teamId}
        AND rr.projectId = ${projectId}
        AND rr.environmentId = ${environmentId}
        AND rr.mode = 'recovery'
        AND rv.teamId = ${teamId}
        AND rv.projectId = ${projectId}
        AND rv.environmentId = ${environmentId}
      LIMIT 1
    `.then((rows) => rows[0]?.sourceVersionId ?? null);
  }

  reserve(input: EnvironmentVersionActionReservationInput) {
    return this.prisma.$transaction((tx) =>
      reserveEnvironmentVersionAction(tx, input),
    );
  }

  replay(input: Parameters<typeof replayEnvironmentVersionAction>[1]) {
    return replayEnvironmentVersionAction(this.prisma, input);
  }

}
