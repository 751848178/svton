import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaService } from "../prisma/prisma.service";
import { LocalFilesystemDeploymentProviderService } from "./local-filesystem-deployment-provider.service";
import { LocalReleaseStagingExecutorService } from "./local-release-staging-executor.service";
import {
  ReleaseArtifactArchivePort,
  UnzipReleaseArtifactArchiveService,
} from "./release-artifact-archive.service";
import { ReleaseBuildArtifactService } from "./release-build-artifact.service";
import { gatePolicyTestDouble } from "./release-gate-test-decision.spec-utils";
import { ReleaseStagingRepository } from "./release-staging.repository";
import { ReleaseStagingService } from "./release-staging.service";
import { seedReleaseStagingProviderScope } from "./release-staging-provider-db.fixture";

export class ReleaseStagingProviderIntegrationFixture {
  readonly prisma = new PrismaClient();
  private readonly suffix = randomUUID();
  readonly userId = `staging-user-${this.suffix}`;
  readonly teamId = `staging-team-${this.suffix}`;
  readonly projectId = `staging-project-${this.suffix}`;
  orderId = "";
  manifestId = "";
  stagingId = "";
  private scope = "";
  private service!: ReleaseStagingService;

  async start() {
    this.scope = await mkdtemp(join(tmpdir(), "f431-staging-integration-"));
    const seeded = await seedReleaseStagingProviderScope(this.prisma, {
      suffix: this.suffix,
      userId: this.userId,
      teamId: this.teamId,
      projectId: this.projectId,
    });
    this.stagingId = seeded.stagingId;
    this.orderId = seeded.orderId;
    const build = seeded.build;
    const checkout = join(this.scope, "checkout");
    await mkdir(join(checkout, "dist"), { recursive: true });
    await writeFile(join(checkout, "dist", "app.txt"), "real provider target");
    const config = providerConfig(this.scope);
    const artifacts = new ReleaseBuildArtifactService(config);
    const artifact = await artifacts.package({
      checkoutRoot: checkout,
      projectId: this.projectId,
      releaseOrderId: this.orderId,
      buildRunId: build.id,
      components: [component()],
    });
    this.manifestId = (
      await this.prisma.artifactManifest.create({
        data: {
          teamId: this.teamId,
          projectId: this.projectId,
          releaseOrderId: this.orderId,
          buildRunId: build.id,
          digest: artifact.digest,
          items: {
            create: [
              {
                componentKey: "project-bundle",
                artifactType: "zip",
                uri: artifact.uri,
                digest: artifact.digest,
              },
            ],
          },
        },
      })
    ).id;
    const provider = new LocalFilesystemDeploymentProviderService(
      config,
      new UnzipReleaseArtifactArchiveService() as ReleaseArtifactArchivePort,
    );
    this.service = new ReleaseStagingService(
      new ReleaseStagingRepository(this.prisma as unknown as PrismaService),
      new LocalReleaseStagingExecutorService(artifacts, provider),
      gatePolicyTestDouble(this.prisma) as never,
    );
  }

  async stop() {
    await this.prisma.environmentVersion.deleteMany({
      where: { teamId: this.teamId },
    });
    await this.prisma.team.delete({ where: { id: this.teamId } });
    await this.prisma.user.delete({ where: { id: this.userId } });
    await this.prisma.$disconnect();
    await rm(this.scope, { recursive: true, force: true });
  }

  deploy() {
    return this.deployManifest(this.manifestId);
  }

  deployManifest(manifestId: string) {
    return this.service.deploy({
      teamId: this.teamId,
      actorId: this.userId,
      projectId: this.projectId,
      releaseOrderId: this.orderId,
      manifestId,
    });
  }

  buildCount() {
    return this.prisma.buildRun.count({
      where: { releaseOrderId: this.orderId },
    });
  }

  deploymentCount() {
    return this.prisma.deploymentRun.count({
      where: { artifactManifestId: this.manifestId },
    });
  }

  allDeploymentCount() {
    return this.prisma.deploymentRun.count({ where: { teamId: this.teamId } });
  }

  deploymentRows() {
    return this.prisma.deploymentRun.findMany({
      where: { artifactManifestId: this.manifestId },
      select: {
        commandPlan: true,
        status: true,
        adapterKey: true,
        result: true,
      },
    });
  }

  readTargetFile(runId: string) {
    return readFile(
      join(
        this.scope,
        "deployments",
        this.projectId,
        this.stagingId,
        "releases",
        runId,
        "dist/app.txt",
      ),
      "utf8",
    );
  }
}

function providerConfig(scope: string) {
  const values: Record<string, unknown> = {
    RELEASE_BUILD_ARTIFACT_ROOT: join(scope, "artifacts"),
    RELEASE_STAGING_DEPLOYMENT_ROOT: join(scope, "deployments"),
    RELEASE_STAGING_DEPLOYMENT_TIMEOUT_MS: 5_000,
  };
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

function component() {
  return {
    key: "service-1",
    name: "api",
    workingDirectory: ".",
    buildCommand: "true",
    artifactOutputs: ["dist"],
    buildEnvironment: {},
  };
}
