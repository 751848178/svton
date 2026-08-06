import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
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
import { withReleaseStagingWorkloadDrift } from "./release-staging-workload-drift.integration-fixture";
import { seedReleaseStagingProviderScope } from "./release-staging-provider-db.fixture";
import {
  cleanupStagingProviderFixture,
  readStagingActiveFile,
  readStagingReleaseFile,
  stagingBuildCount,
  stagingDeploymentCount,
  stagingDeploymentRows,
} from "./release-staging-provider-inspection.fixture";
import {
  releaseStagingProviderComponent,
  releaseStagingProviderConfig,
  releaseStagingRepository,
  releaseStagingWorkloadService,
  writeReleaseStagingFixture,
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
  serviceId = "";
  private scope = "";
  private service!: ReleaseStagingService;
  repository!: ReleaseStagingRepository;
  private inputs!: ReleaseDeploymentInputService;
  private workloads!: ReturnType<typeof releaseStagingWorkloadService>;
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
    this.serviceId = seeded.serviceId;
    const build = seeded.build;
    const checkout = join(this.scope, "checkout");
    await writeReleaseStagingFixture(checkout);
    const config = releaseStagingProviderConfig(this.scope);
    const artifacts = new ReleaseBuildArtifactService(config);
    const artifact = await artifacts.package({
      checkoutRoot: checkout,
      projectId: this.projectId,
      releaseOrderId: this.orderId,
      buildRunId: build.id,
      components: [releaseStagingProviderComponent(this.serviceId)],
    });
    const componentArtifact = artifact.items.find(
      (item) => item.componentKey === this.serviceId,
    );
    if (!componentArtifact)
      throw new Error("Staging component artifact missing");
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
              {
                componentKey: componentArtifact.componentKey,
                artifactType: componentArtifact.artifactType,
                uri: componentArtifact.uri,
                digest: componentArtifact.digest,
                metadata: {
                  outputs: componentArtifact.outputs,
                  contentIndex: componentArtifact.contentIndex,
                },
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
    this.workloads = releaseStagingWorkloadService(this.prisma);
    this.repository = releaseStagingRepository(this.prisma);
    this.service = new ReleaseStagingService(
      this.repository,
      new LocalReleaseStagingExecutorService(artifacts, provider),
      gatePolicyTestDouble(this.prisma) as never,
      this.inputs,
      this.workloads,
    );
  }

  async stop() {
    await cleanupStagingProviderFixture(this.prisma, {
      teamId: this.teamId,
      userId: this.userId,
      resourceTypeId: this.resourceTypeId,
      scope: this.scope,
    });
  }
  deploy = () => this.deployManifest(this.manifestId);
  deployManifest(manifestId: string) {
    return this.service.deploy({
      teamId: this.teamId,
      actorId: this.userId,
      projectId: this.projectId,
      releaseOrderId: this.orderId,
      manifestId,
    });
  }
  deployWithDrift = (kind: ReleaseDeploymentInputDrift) =>
    withReleaseDeploymentInputDrift(
      this.inputs,
      this.prisma,
      this,
      kind,
      this.deploy,
    );

  deployWithForeignBinding = () =>
    withForeignReleaseTargetScope(this.prisma, this.crypto, this, this.deploy);

  deployWithWorkloadDrift = () =>
    withReleaseStagingWorkloadDrift(
      this.workloads,
      this.prisma,
      this.serviceId,
      this.deploy,
    );
  buildCount = () => stagingBuildCount(this.prisma, this.orderId);
  allDeploymentCount = () => stagingDeploymentCount(this.prisma, this.teamId);
  deploymentRows = () => stagingDeploymentRows(this.prisma, this.manifestId);

  readReleaseFile(runId: string, relativePath: string) {
    return readStagingReleaseFile(
      this.scope,
      this.projectId,
      this.stagingId,
      runId,
      relativePath,
    );
  }

  readActiveFile = () =>
    readStagingActiveFile(this.scope, this.projectId, this.stagingId);
}
