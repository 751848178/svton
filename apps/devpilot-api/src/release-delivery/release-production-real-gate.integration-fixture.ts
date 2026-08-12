import { PrismaClient } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestCryptoService } from "../common/crypto/crypto.test-helpers";
import { PrismaService } from "../prisma/prisma.service";
import { EnvironmentVersionGateEvidenceRepository } from "./environment-version-gate-evidence.repository";
import { EnvironmentVersionPolicyService } from "./environment-version-policy.service";
import { EnvironmentVersionProductionGateService } from "./environment-version-production-gate.service";
import { EnvironmentVersionReadRepository } from "./environment-version-read.repository";
import { EnvironmentVersionRepository } from "./environment-version.repository";
import { EnvironmentVersionService } from "./environment-version.service";
import { GateEvaluationRepository } from "./gate-evaluation.repository";
import { LocalFilesystemDeploymentProviderService } from "./local-filesystem-deployment-provider.service";
import { LocalReleaseStagingExecutorService } from "./local-release-staging-executor.service";
import {
  ReleaseArtifactArchivePort,
  UnzipReleaseArtifactArchiveService,
} from "./release-artifact-archive.service";
import { ReleaseBuildArtifactService } from "./release-build-artifact.service";
import { ReleaseDeploymentInputService } from "./release-deployment-input.service";
import { ReleaseGateApprovalCapabilityProvider } from "./release-gate-approval-capability.provider";
import { ReleaseGateArtifactCapabilityProvider } from "./release-gate-artifact-capability.provider";
import { ReleaseGateBuildCapabilityProvider } from "./release-gate-build-capability.provider";
import { ReleaseGateCapabilityRegistryService } from "./release-gate-capability-registry.service";
import { ReleaseGateConfigCapabilityProvider } from "./release-gate-config-capability.provider";
import { ReleaseGateDecisionRepository } from "./release-gate-decision.repository";
import { ReleaseGateDecisionService } from "./release-gate-decision.service";
import { ReleaseGateDeployEvidenceRepository } from "./release-gate-deploy-evidence.repository";
import { ReleaseGateDeployOperationEvidenceRepository } from "./release-gate-deploy-operation-evidence.repository";
import { ReleaseGateDeployResourceEvidenceRepository } from "./release-gate-deploy-resource-evidence.repository";
import { ReleaseGateEvidenceRepository } from "./release-gate-evidence.repository";
import { ReleaseGateEvaluationService } from "./release-gate-evaluation.service";
import { ReleaseGateIngressCapabilityProvider } from "./release-gate-ingress-capability.provider";
import { ReleaseGateMigrationCapabilityProvider } from "./release-gate-migration-capability.provider";
import { ReleaseGateObservabilityCapabilityProvider } from "./release-gate-observability-capability.provider";
import { ReleaseGatePromoteEvidenceRepository } from "./release-gate-promote-evidence.repository";
import { ReleaseGatePromotionCapabilityProvider } from "./release-gate-promotion-capability.provider";
import { ReleaseGateProductionApplicabilityProvider } from "./release-gate-production-applicability.provider";
import { ReleaseGateRecoveryStrategyProvider } from "./release-gate-recovery-strategy.provider";
import { ReleaseGateRuntimeCapabilityProvider } from "./release-gate-runtime-capability.provider";
import { ReleaseGateSourceCapabilityProvider } from "./release-gate-source-capability.provider";
import { ReleaseProductionRepository } from "./release-production.repository";
import { ReleaseProductionWorkloadService } from "./release-production-workload.service";
import { ReleaseStagingWorkloadService } from "./release-staging-workload.service";
import { ReleaseStagingExecutorPort } from "./release-staging.types";
import { ReleaseStagingWorkloadStateRepository } from "./release-staging-workload-state.repository";
import {
  releaseStagingProviderComponent,
  releaseStagingProviderConfig,
  writeReleaseStagingFixture,
} from "./release-staging-provider.integration-utils";
import { SiteRouteActivationService } from "../site/site-route-activation.service";
import { SiteFinalProbeService } from "../site/site-final-probe.service";
import type { SiteProbePort } from "../site/site-route-activation.types";
import { SiteRouteSwitchSagaOrchestrator } from "../site/site-route-switch-saga.orchestrator";
import { SiteRouteSwitchSagaRepository } from "../site/site-route-switch-saga.repository";
import { siteRouteSwitchTestDouble } from "../site/site-route-switch.spec-utils";
import { EnvironmentVersionCompletionRepository } from "./environment-version-completion.repository";
import {
  managedCommandWorkloadConfig,
  stagingArtifactProofParams,
} from "./release-workload.integration-fixtures";

export interface ProductionRealGateFixture {
  prisma: PrismaClient;
  userId: string;
  teamId: string;
  projectId: string;
  orderId: string;
  manifestId: string;
  buildRunId: string;
  productionEnvironmentId: string;
  configRevisionId: string;
  siteId: string;
  serviceId: string;
  managedResourceId: string;
  scope: string;
  repository: ReleaseProductionRepository;
  service: EnvironmentVersionService;
  stop: () => Promise<void>;
}

export async function createProductionRealGateFixture(
  siteProbe: SiteProbePort = new SiteFinalProbeService(),
): Promise<ProductionRealGateFixture> {
  const prisma = new PrismaClient();
  const suffix = randomUUID();
  const userId = `f437-user-${suffix}`;
  const teamId = `f437-team-${suffix}`;
  const projectId = `f437-project-${suffix}`;
  const serviceId = `f437-service-${suffix}`;
  const commitSha = "c".repeat(40);
  const manifestDigest = `sha256:${"f".repeat(64)}`;
  const scope = await mkdtemp(join(tmpdir(), "f437-production-real-gate-"));
  const now = new Date();

  const created = await prisma.user.create({
    data: { id: userId, email: `${suffix}@f437.example`, role: "user" },
  });
  const team = await prisma.team.create({
    data: { id: teamId, name: "F437 Team" },
  });
  const project = await prisma.project.create({
    data: {
      id: projectId,
      teamId,
      createdById: userId,
      name: "F437 Production Project",
      config: {},
    },
  });
  const staging = await prisma.projectEnvironment.create({
    data: {
      teamId,
      projectId,
      key: "staging",
      name: "Staging",
      baselineRole: "staging",
    },
  });
  const production = await prisma.projectEnvironment.create({
    data: {
      teamId,
      projectId,
      key: "production",
      name: "Production",
      baselineRole: "production",
    },
  });
  const application = await prisma.application.create({
    data: {
      teamId,
      projectId,
      createdById: userId,
      name: "F437 application",
    },
  });
  const applicationService = await prisma.applicationService.create({
    data: {
      id: serviceId,
      teamId,
      projectId,
      applicationId: application.id,
      environmentId: production.id,
      name: "api",
      kind: "static",
      deployConfig: managedCommandWorkloadConfig(),
    },
  });
  const server = await prisma.server.create({
    data: {
      teamId,
      createdById: userId,
      name: "F437 filesystem target",
      host: "local-provider",
      username: "devpilot",
      authType: "password",
      credentials: "not-used-by-local-provider",
      status: "online",
    },
  });
  await prisma.projectEnvironmentServer.create({
    data: {
      teamId,
      projectId,
      environmentId: production.id,
      serverId: server.id,
      role: "deployment",
      metadata: {
        releaseDeployment: {
          providerKey: "local-filesystem-v1",
          targetRef: "filesystem-release-target",
        },
      },
    },
  });
  const managedResource = await prisma.managedResource.create({
    data: {
      teamId,
      projectId,
      environmentId: production.id,
      sourceType: "server",
      provider: "docker",
      kind: "mysql",
      name: "f437-prod-db",
      externalId: `f437-prod-db-${suffix}`,
      status: "active",
      lastSyncAt: now,
    },
  });
  const revision = await prisma.environmentConfigRevision.create({
    data: {
      teamId,
      projectId,
      environmentId: production.id,
      createdById: userId,
      revision: 1,
      snapshotHash: "f".repeat(64),
      plainVariables: {},
      secretReferences: [],
      resourceReferences: [
        {
          id: managedResource.id,
          kind: "managed_resource",
          name: managedResource.name,
          sharedEnvironmentIds: [production.id],
          risk: "medium",
          impact: "f437 production runtime database",
        },
      ],
      routeSnapshot: {
        domains: ["demo.f437.example"],
        proxyTarget: "http://127.0.0.1:8080",
      },
      policyReferences: [],
    },
  });
  await prisma.projectEnvironment.update({
    where: { id: production.id },
    data: { currentConfigRevisionId: revision.id },
  });
  await prisma.resourceConnectionRun.create({
    data: {
      teamId,
      projectId,
      environmentId: production.id,
      resourceId: managedResource.id,
      sourceType: "server",
      provider: "docker",
      kind: "mysql",
      authAdapterKey: "test-auth",
      executorKey: "test-executor",
      adapterKey: "test-adapter",
      dryRun: false,
      status: "completed",
      finishedAt: now,
    },
  });
  await prisma.resourceMetricSnapshot.create({
    data: {
      teamId,
      projectId,
      environmentId: production.id,
      resourceId: managedResource.id,
      sourceType: "server",
      provider: "docker",
      kind: "mysql",
      status: "collected",
      sampledAt: now,
      raw: {
        capacityFit: true,
        observability: { metrics: true, traces: true, alerts: true },
      },
    },
  });
  await prisma.backupRun.create({
    data: {
      teamId,
      projectId,
      environmentId: production.id,
      resourceId: managedResource.id,
      actorId: userId,
      dryRun: false,
      status: "completed",
      finishedAt: now,
    },
  });
  const repositoryConnection = await prisma.repositoryConnection.create({
    data: {
      teamId,
      projectId,
      connectedById: userId,
      provider: "generic",
      repositoryUrl: "https://github.com/f437/demo.git",
      status: "connected",
      commitSha,
      verifiedAt: now,
    },
  });
  await prisma.repositoryAnalysisRun.create({
    data: {
      teamId,
      projectId,
      connectionId: repositoryConnection.id,
      triggeredById: userId,
      repositoryUrl: "https://github.com/f437/demo.git",
      branch: "main",
      commitSha,
      status: "succeeded",
      parserVersion: "f437-parser-v1",
      idempotencyKey: `f437-analysis-${suffix}`,
      result: {
        migrationEvidence: {
          schemaDrift: false,
          orderValid: true,
          destructiveChanges: [],
          checkedAt: now.toISOString(),
        },
      },
      finishedAt: now,
    },
  });
  const order = await prisma.releaseOrder.create({
    data: {
      teamId,
      projectId,
      createdById: userId,
      releaseVersion: "4.37.0",
    },
  });
  const build = await prisma.buildRun.create({
    data: {
      teamId,
      projectId,
      releaseOrderId: order.id,
      triggeredById: userId,
      revision: 1,
      sourceBranch: "main",
      sourceCommitSha: commitSha,
      inputSnapshot: {},
      inputHash: `f437-build-${suffix}`,
      status: "succeeded",
    },
  });
  const checkout = join(scope, "checkout");
  await writeReleaseStagingFixture(checkout);
  const config = releaseStagingProviderConfig(scope);
  const artifacts = new ReleaseBuildArtifactService(config);
  const artifact = await artifacts.package({
    checkoutRoot: checkout,
    projectId,
    releaseOrderId: order.id,
    buildRunId: build.id,
    components: [releaseStagingProviderComponent(serviceId)],
  });
  const componentArtifact = artifact.items.find(
    (item) => item.componentKey === serviceId,
  );
  if (!componentArtifact) throw new Error("F437 component artifact missing");
  const manifest = await prisma.artifactManifest.create({
    data: {
      teamId,
      projectId,
      releaseOrderId: order.id,
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
    include: { items: true },
  });
  await prisma.deploymentRun.create({
    data: {
      teamId,
      projectId,
      actorId: userId,
      environmentId: staging.id,
      artifactManifestId: manifest.id,
      source: "release_order",
      targetType: "release-artifact",
      executorKey: "release-artifact",
      adapterKey: "local-filesystem-v1",
      dryRun: false,
      status: "completed",
      finishedAt: now,
      params: stagingArtifactProofParams(manifest),
      result: {
        artifactVerified: true,
        manifestId: manifest.id,
        manifestDigest: manifest.digest,
      },
    },
  });
  for (const id of ["version-a", "version-b"]) {
    const priorRun = await prisma.deploymentRun.create({
      data: {
        teamId,
        projectId,
        actorId: userId,
        environmentId: production.id,
        artifactManifestId: manifest.id,
        source: "release_order",
        targetType: "release-artifact",
        executorKey: "release-artifact",
        adapterKey: "local-filesystem-v1",
        dryRun: false,
        status: "completed",
        finishedAt: now,
        result: {
          artifactVerified: true,
          manifestId: manifest.id,
          manifestDigest: manifest.digest,
        },
      },
    });
    await prisma.environmentVersion.create({
      data: {
        id: `f437-version-${id}-${suffix}`,
        teamId,
        projectId,
        environmentId: production.id,
        releaseOrderId: order.id,
        artifactManifestId: manifest.id,
        deploymentRunId: priorRun.id,
        kind: "deploy",
        effectiveAt:
          id === "version-a"
            ? new Date(now.getTime() - 3_600_000)
            : new Date(now.getTime() - 7_200_000),
      },
    });
  }
  const versionA = await prisma.environmentVersion.findUniqueOrThrow({
    where: { id: `f437-version-version-a-${suffix}` },
  });
  await prisma.projectEnvironment.update({
    where: { id: production.id },
    data: { currentEnvironmentVersionId: versionA.id },
  });
  const site = await prisma.site.create({
    data: {
      teamId,
      createdById: userId,
      projectId,
      environmentId: production.id,
      name: "F437 demo site",
      primaryDomain: "demo.f437.example",
      tls: {
        status: "valid",
        expiresAt: new Date(now.getTime() + 86400_000).toISOString(),
      },
      status: "active",
      lastSyncAt: now,
    },
  });
  const logStream = await prisma.logStream.create({
    data: {
      teamId,
      projectId,
      environmentId: production.id,
      createdById: userId,
      name: "f437 production log stream",
      sourceType: "site",
    },
  });
  await prisma.logCollectionRun.create({
    data: {
      teamId,
      projectId,
      environmentId: production.id,
      streamId: logStream.id,
      sourceType: "site",
      executorKey: "server-executor",
      adapterKey: "log-collection-plan",
      dryRun: false,
      status: "completed",
      ingestedEntryCount: 3,
      result: { collected: true, entries: 3 },
      finishedAt: now,
    },
  });

  const db = prisma as unknown as PrismaService;
  const crypto = createTestCryptoService();
  const provider = new LocalFilesystemDeploymentProviderService(
    config,
    new UnzipReleaseArtifactArchiveService() as ReleaseArtifactArchivePort,
  );
  const executor = new LocalReleaseStagingExecutorService(artifacts, provider);
  const capabilityRegistry = new ReleaseGateCapabilityRegistryService(
    new ReleaseGateSourceCapabilityProvider(),
    new ReleaseGateBuildCapabilityProvider(),
    new ReleaseGateArtifactCapabilityProvider(),
    new ReleaseGateConfigCapabilityProvider(),
    new ReleaseGateRuntimeCapabilityProvider(),
    new ReleaseGateMigrationCapabilityProvider(),
    new ReleaseGateApprovalCapabilityProvider(),
    new ReleaseGateIngressCapabilityProvider(),
    new ReleaseGatePromotionCapabilityProvider(),
    new ReleaseGateObservabilityCapabilityProvider(),
    new ReleaseGateRecoveryStrategyProvider(),
    new ReleaseGateProductionApplicabilityProvider(),
  );
  const gateEvaluator = new ReleaseGateEvaluationService(
    new ReleaseGateEvidenceRepository(db),
    new ReleaseGateDeployEvidenceRepository(
      db,
      new ReleaseGateDeployResourceEvidenceRepository(db),
      new ReleaseGateDeployOperationEvidenceRepository(db),
    ),
    new ReleaseGatePromoteEvidenceRepository(db),
    capabilityRegistry,
    new GateEvaluationRepository(db),
  );
  const gateService = new ReleaseGateDecisionService(
    gateEvaluator,
    new ReleaseGateDecisionRepository(db),
  );
  const routeSagaGuard = { assertClear: jest.fn().mockResolvedValue(undefined) };
  const repository = new EnvironmentVersionRepository(db);
  const routeSwitch = siteRouteSwitchTestDouble();
  const routeSagaRepository = new SiteRouteSwitchSagaRepository(db);
  const service = new EnvironmentVersionService(
    repository,
    new EnvironmentVersionCompletionRepository(db, routeSagaRepository),
    new EnvironmentVersionReadRepository(db),
    new EnvironmentVersionPolicyService(repository),
    executor as ReleaseStagingExecutorPort,
    new EnvironmentVersionProductionGateService(
      gateService,
      routeSagaGuard as never,
    ),
    new EnvironmentVersionGateEvidenceRepository(db),
    new ReleaseDeploymentInputService(db, crypto),
    {} as never,
    new ReleaseStagingWorkloadService(
      new ReleaseStagingWorkloadStateRepository(db),
    ),
    new ReleaseProductionWorkloadService(
      new ReleaseStagingWorkloadStateRepository(db),
    ),
    new SiteRouteActivationService(db),
    routeSwitch,
    new SiteRouteSwitchSagaOrchestrator(routeSagaRepository, routeSwitch),
    routeSagaGuard as never,
    siteProbe,
  );

  return {
    prisma,
    userId,
    teamId,
    projectId,
    orderId: order.id,
    manifestId: manifest.id,
    buildRunId: build.id,
    productionEnvironmentId: production.id,
    configRevisionId: revision.id,
    siteId: site.id,
    serviceId: applicationService.id,
    managedResourceId: managedResource.id,
    scope,
    repository: new ReleaseProductionRepository(db),
    service,
    stop: async () => {
      await prisma.gateEvaluation.deleteMany({ where: { teamId } });
      await prisma.releaseGateDecision.deleteMany({ where: { teamId } });
      await prisma.environmentVersion.deleteMany({ where: { teamId } });
      await prisma.deploymentRun.deleteMany({ where: { teamId } });
      await prisma.operationApproval.deleteMany({ where: { teamId } });
      await prisma.releaseRun.deleteMany({ where: { teamId } });
      await prisma.logCollectionRun.deleteMany({ where: { teamId } });
      await prisma.logStream.deleteMany({ where: { teamId } });
      await prisma.siteRouteSwitchRun.deleteMany({ where: { teamId } });
      await prisma.site.deleteMany({ where: { teamId } });
      await prisma.resourceConnectionRun.deleteMany({ where: { teamId } });
      await prisma.resourceMetricSnapshot.deleteMany({ where: { teamId } });
      await prisma.backupRun.deleteMany({ where: { teamId } });
      await prisma.repositoryAnalysisRun.deleteMany({ where: { teamId } });
      await prisma.repositoryConnection.deleteMany({ where: { teamId } });
      await prisma.applicationService.deleteMany({ where: { teamId } });
      await prisma.application.deleteMany({ where: { teamId } });
      await prisma.projectEnvironmentServer.deleteMany({ where: { teamId } });
      await prisma.managedResource.deleteMany({ where: { teamId } });
      await prisma.server.deleteMany({ where: { teamId } });
      await prisma.artifactManifest.deleteMany({ where: { teamId } });
      await prisma.buildRun.deleteMany({ where: { teamId } });
      await prisma.environmentConfigRevision.deleteMany({ where: { teamId } });
      await prisma.projectEnvironment.deleteMany({ where: { teamId } });
      await prisma.releaseOrder.deleteMany({ where: { teamId } });
      await prisma.project.delete({ where: { id: projectId } });
      await prisma.team.delete({ where: { id: teamId } });
      await prisma.user.delete({ where: { id: userId } });
      await prisma.$disconnect();
      await rm(scope, { recursive: true, force: true });
    },
  };
}

export async function approveProductionReleaseRun(
  fixture: ProductionRealGateFixture,
  runId: string,
) {
  const run = await fixture.prisma.releaseRun.findUniqueOrThrow({
    where: { id: runId },
    include: { operationApproval: true },
  });
  if (!run.operationApproval) {
    throw new Error("F437 release run has no approval to approve");
  }
  await fixture.prisma.operationApproval.update({
    where: { id: run.operationApproval.id },
    data: {
      status: "approved",
      reviewerId: fixture.userId,
      reviewedAt: new Date(),
      reviewComment: "f437 approved",
    },
  });
  return run;
}

export async function confirmProductionRun(
  fixture: ProductionRealGateFixture,
  idempotencyKey: string,
) {
  const preview = await fixture.repository.preview(
    fixture.teamId,
    fixture.projectId,
    fixture.orderId,
    fixture.manifestId,
  );
  return fixture.repository.confirm({
    teamId: fixture.teamId,
    projectId: fixture.projectId,
    releaseOrderId: fixture.orderId,
    manifestId: fixture.manifestId,
    actorId: fixture.userId,
    expectedInputHash: preview.inputHash,
    idempotencyKey,
  });
}
