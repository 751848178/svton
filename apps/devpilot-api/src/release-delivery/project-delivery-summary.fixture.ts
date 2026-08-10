import type { ProjectDeliverySummaryRecord } from "./project-delivery-summary.select";
import { frozenRepositoryIntakeFinalization } from "../project-intake/repository-intake-summary.fixture";

export function projectDeliverySummaryRecord(
  overrides: Partial<ProjectDeliverySummaryRecord> = {},
): ProjectDeliverySummaryRecord {
  const projectId = overrides.id ?? "project-1";
  return {
    id: projectId,
    teamId: "team-1",
    name: "Payments",
    repositoryIdentity: {
      id: "identity-1",
      teamId: "team-1",
      projectId,
      provider: "github",
      canonicalKey: "github.com/example/payments",
      canonicalUrl: "https://github.com/example/payments",
      lockedAt: new Date("2026-08-04T00:00:00.000Z"),
      currentRevision: {
        id: "identity-revision-1",
        teamId: "team-1",
        projectId,
        identityId: "identity-1",
        revision: 1,
        defaultBranch: "main",
        reason: "initial identity",
        createdAt: new Date("2026-08-04T00:00:00.000Z"),
      },
    },
    repositoryConnection: {
      provider: "github",
      repositoryUrl: "git@github.com:example/payments.git",
      defaultBranch: "main",
      selectedBranch: "main",
      status: "connected",
    },
    intakeFinalizations: [
      frozenRepositoryIntakeFinalization(projectId, intakeDecisions()),
    ],
    environments: [
      environment(projectId, "staging"),
      environment(projectId, "production"),
    ],
    resourceInstances: [resource(projectId, "resource-1", "env-staging")],
    managedResources: [resource(projectId, "managed-1", "env-production")],
    secretKeys: [resource(projectId, "secret-1", null)],
    cdnConfigs: [resource(projectId, "cdn-1", "env-production")],
    sites: [
      {
        ...resource(projectId, "site-1", "env-production"),
        primaryDomain: "pay.example.com",
        status: "active",
      },
      {
        ...resource(projectId, "site-2", null),
        primaryDomain: "preview.example.com",
        status: "draft",
      },
    ],
    ...overrides,
  } as ProjectDeliverySummaryRecord;
}

function environment(projectId: string, role: "staging" | "production") {
  const id = `env-${role}`;
  const orderId = `order-${role}`;
  const manifestId = `manifest-${role}`;
  const deploymentId = `deployment-${role}`;
  const versionId = `version-${role}`;
  return {
    id,
    teamId: "team-1",
    projectId,
    key: role,
    name: role === "staging" ? "Staging" : "Production",
    status: "active",
    baselineRole: role,
    identityLockedAt: new Date("2026-08-04T00:00:00.000Z"),
    currentConfigRevisionId: `config-${role}`,
    currentEnvironmentVersionId: versionId,
    currentConfigRevision: {
      id: `config-${role}`,
      teamId: "team-1",
      projectId,
      environmentId: id,
    },
    currentEnvironmentVersion: {
      id: versionId,
      teamId: "team-1",
      projectId,
      environmentId: id,
      releaseOrderId: orderId,
      artifactManifestId: manifestId,
      deploymentRunId: deploymentId,
      effectiveAt: new Date(
        `2026-08-04T0${role === "staging" ? 1 : 2}:00:00.000Z`,
      ),
      releaseOrder: {
        id: orderId,
        teamId: "team-1",
        projectId,
        releaseVersion: role === "staging" ? "2.4.0-rc.1" : "2.3.2",
      },
      artifactManifest: {
        id: manifestId,
        teamId: "team-1",
        projectId,
        releaseOrderId: orderId,
        digest: `sha256:${(role === "staging" ? "a" : "b").repeat(64)}`,
      },
      deploymentRun: {
        id: deploymentId,
        teamId: "team-1",
        projectId,
        environmentId: id,
        artifactManifestId: manifestId,
        source: "release_order",
        status: "completed",
        dryRun: false,
      },
    },
  };
}

function resource(projectId: string, id: string, environmentId: string | null) {
  return { id, teamId: "team-1", projectId, environmentId };
}

function intakeDecisions() {
  return [
    {
      kind: "project_repository",
      decision: "accept",
      reviewedValue: {
        intakeContract: {
          overview: {
            projectType: "web_application",
            architecture: "monorepo",
          },
        },
      },
    },
    {
      kind: "application_service",
      decision: "edit",
      reviewedValue: {
        metadata: {
          repositoryAnalysis: {
            intakeContract: { name: "web", path: "apps/web" },
          },
        },
      },
    },
  ];
}
