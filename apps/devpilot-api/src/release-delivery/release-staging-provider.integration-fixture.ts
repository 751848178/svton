import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaService } from "../prisma/prisma.service";
import { createTestCryptoService } from "../common/crypto/crypto.test-helpers";
import { LocalFilesystemDeploymentProviderService } from "./local-filesystem-deployment-provider.service";
import { LocalReleaseStagingExecutorService } from "./local-release-staging-executor.service";
import {
  ReleaseArtifactArchivePort,
  UnzipReleaseArtifactArchiveService,
} from "./release-artifact-archive.service";
import { ReleaseBuildArtifactService } from "./release-build-artifact.service";
import { ReleaseDeploymentInputService } from "./release-deployment-input.service";
import {
  type ReleaseDeploymentInputDrift,
  withForeignReleaseTargetScope,
  withReleaseDeploymentInputDrift,
} from "./release-deployment-input-drift.integration-fixture";
import { gatePolicyTestDouble } from "./release-gate-test-decision.spec-utils";
import { ReleaseStagingRepository } from "./release-staging.repository";
import { ReleaseStagingService } from "./release-staging.service";
import { seedReleaseStagingProviderScope } from "./release-staging-provider-db.fixture";
import {
  releaseStagingProviderComponent,
  releaseStagingProviderConfig,
} from "./release-staging-provider.integration-utils";

export class ReleaseStagingProviderIntegrationFixture {
  readonly prisma = new PrismaClient();
  private readonly suffix = randomUUID();
  readonly userId = `staging-user-${this.suffix}`;
  readonly teamId = `staging-team-${this.suffix}`;
  readonly projectId = `staging-project-${this.suffix}`;
  orderId = "";
  manifestId = "";
  stagingId = "";
  revisionId = "";
  resourceId = "";
  resourceTypeId = "";
  serverId = "";
  bindingId = "";
  private scope = "";
  private service!: ReleaseStagingService;
  private inputs!: ReleaseDeploymentInputService;
  private readonly crypto = createTestCryptoService();

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
    this.revisionId = seeded.revisionId;
    this.resourceId = seeded.resourceId;
    this.resourceTypeId = seeded.resourceTypeId;
    this.serverId = seeded.serverId;
    this.bindingId = seeded.bindingId;
    const build = seeded.build;
    const checkout = join(this.scope, "checkout");
    await mkdir(join(checkout, "dist"), { recursive: true });
    await writeFile(join(checkout, "dist", "app.txt"), "real provider target");
    const config = releaseStagingProviderConfig(this.scope);
    const artifacts = new ReleaseBuildArtifactService(config);
    const artifact = await artifacts.package({
      checkoutRoot: checkout,
      projectId: this.projectId,
      releaseOrderId: this.orderId,
      buildRunId: build.id,
      components: [releaseStagingProviderComponent()],
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
    this.inputs = new ReleaseDeploymentInputService(
      this.prisma as unknown as PrismaService,
      this.crypto,
    );
    this.service = new ReleaseStagingService(
      new ReleaseStagingRepository(this.prisma as unknown as PrismaService),
      new LocalReleaseStagingExecutorService(artifacts, provider),
      gatePolicyTestDouble(this.prisma) as never,
      this.inputs,
    );
  }

  async stop() {
    await this.prisma.environmentVersion.deleteMany({
      where: { teamId: this.teamId },
    });
    await this.prisma.team.delete({ where: { id: this.teamId } });
    await this.prisma.resourceType.delete({
      where: { id: this.resourceTypeId },
    });
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

  async deployWithDrift(kind: ReleaseDeploymentInputDrift) {
    return withReleaseDeploymentInputDrift(
      this.inputs,
      this.prisma,
      this,
      kind,
      () => this.deploy(),
    );
  }

  deployWithForeignBinding() {
    return withForeignReleaseTargetScope(this.prisma, this.crypto, this, () =>
      this.deploy(),
    );
  }

  buildCount() {
    return this.prisma.buildRun.count({
      where: { releaseOrderId: this.orderId },
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
        params: true,
        logs: true,
        result: true,
        error: true,
      },
    });
  }

  readReleaseFile(runId: string, relativePath: string) {
    return readFile(
      join(
        this.scope,
        "deployments",
        this.projectId,
        this.stagingId,
        "releases",
        runId,
        relativePath,
      ),
      "utf8",
    );
  }
}
