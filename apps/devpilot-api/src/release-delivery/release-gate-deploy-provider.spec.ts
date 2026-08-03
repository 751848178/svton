import { ReleaseGateArtifactCapabilityProvider } from "./release-gate-artifact-capability.provider";
import { ReleaseGateBuildCapabilityProvider } from "./release-gate-build-capability.provider";
import { ReleaseGateCapabilityRegistryService } from "./release-gate-capability-registry.service";
import { ReleaseGateConfigCapabilityProvider } from "./release-gate-config-capability.provider";
import type { ReleaseGateCapabilityId } from "./release-gate-catalog.types";
import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import { RELEASE_GATE_DEFINITIONS } from "./release-gate-definition.catalog";
import { ReleaseGateMigrationCapabilityProvider } from "./release-gate-migration-capability.provider";
import { ReleaseGateRuntimeCapabilityProvider } from "./release-gate-runtime-capability.provider";
import { ReleaseGateSourceCapabilityProvider } from "./release-gate-source-capability.provider";

const NOW = new Date("2026-08-03T09:10:00.000Z");

describe("Deploy release gate providers", () => {
  const registry = new ReleaseGateCapabilityRegistryService(
    new ReleaseGateSourceCapabilityProvider(),
    new ReleaseGateBuildCapabilityProvider(),
    new ReleaseGateArtifactCapabilityProvider(),
    new ReleaseGateConfigCapabilityProvider(),
    new ReleaseGateRuntimeCapabilityProvider(),
    new ReleaseGateMigrationCapabilityProvider(),
  );

  it("reports positive environment-scoped M06-M09 evidence", () => {
    const context = evidenceContext();
    const checks = evaluate(registry, context);
    for (const id of ["D01", "D02", "D03", "D05", "D07", "D08", "D10", "D11", "D12"]) {
      expect(checks[id]).toMatchObject({ status: "checked", fresh: true });
      expect(checks[id].evidenceRef).toBeTruthy();
    }
    expect(checks.D09.status).toBe("unavailable");
    expect(registry.list(context).filter((item) =>
      (["M06", "M07", "M08", "M09"] as ReleaseGateCapabilityId[]).includes(item.id),
    ).every((item) => item.available)).toBe(true);
  });

  it("blocks plaintext, cross-environment, and failed ownership evidence", () => {
    const context = evidenceContext();
    const deploy = context.deploy!;
    const revision = deploy.environment!.currentConfigRevision!;
    revision.secretReferences = [{ id: "secret-1", name: "API", type: "api_key", value: "plaintext" }];
    deploy.resources[0].environmentId = "other-env";
    deploy.deployments[0].environmentId = "other-env";
    deploy.connections[0].environmentId = "other-env";
    deploy.metrics[0].environmentId = "other-env";
    deploy.backups[0].environmentId = "other-env";
    const checks = evaluate(registry, context);
    expect(checks.D02.status).toBe("blocked");
    expect(checks.D03.status).toBe("blocked");
    expect(checks.D01.reasonCode).toBe("deployment_environment_mismatch");
    expect(checks.D08.reasonCode).toBe("resource_environment_mismatch");
    expect(checks.D05.reasonCode).toBe("metric_environment_mismatch");
    expect(checks.D12.reasonCode).toBe("backup_environment_mismatch");
  });

  it("turns expired connectivity, metrics, migration, and backup into unchecked", () => {
    const context = evidenceContext();
    const old = new Date("2026-07-01T00:00:00.000Z");
    const deploy = context.deploy!;
    deploy.connections[0].finishedAt = old;
    deploy.metrics[0].sampledAt = old;
    deploy.backups[0].finishedAt = old;
    const analysis = context.project.repositoryAnalysisRuns[0];
    analysis.result = {
      migrationEvidence: {
        checkedAt: old.toISOString(),
        schemaDrift: false,
        orderValid: true,
        destructiveChanges: [],
      },
    };
    const checks = evaluate(registry, context);
    for (const id of ["D05", "D08", "D10", "D11", "D12"]) {
      expect(checks[id]).toMatchObject({
        status: "unchecked", reasonCode: "evidence_stale", fresh: false,
      });
    }
  });

  it("keeps missing connectivity, capacity, migration, backup, and network providers unavailable", () => {
    const context = evidenceContext();
    context.deploy!.connections = [];
    context.deploy!.metrics = [];
    context.deploy!.backups = [];
    context.project.repositoryAnalysisRuns[0].result = {};
    const checks = evaluate(registry, context);
    expect(checks.D08.status).toBe("unavailable");
    expect(checks.D05.status).toBe("unavailable");
    expect(checks.D09.status).toBe("unavailable");
    expect(checks.D10.status).toBe("unavailable");
    expect(checks.D11.status).toBe("unavailable");
    expect(checks.D12.status).toBe("unavailable");
  });
});

function evaluate(
  registry: ReleaseGateCapabilityRegistryService,
  context: ReleaseGateEvidenceContext,
) {
  return Object.fromEntries(RELEASE_GATE_DEFINITIONS
    .filter((definition) => definition.capabilityId
      && ["M06", "M07", "M08", "M09"].includes(definition.capabilityId))
    .map((definition) => [definition.id, registry.evaluate(definition, context, NOW)]));
}

function evidenceContext() {
  const at = new Date("2026-08-03T09:09:00.000Z");
  const environmentId = "staging-1";
  return {
    id: "order-1", projectId: "project-1", releaseVersion: "2.4.1",
    project: {
      repositoryConnection: null,
      repositoryAnalysisRuns: [{
        id: "analysis-1", status: "succeeded", branch: "main", commitSha: "abc123",
        parserVersion: "f403.1", result: {
          migrationEvidence: {
            checkedAt: at.toISOString(), schemaDrift: false,
            orderValid: true, destructiveChanges: [],
          },
        },
        errorCode: null, errorMessage: null, finishedAt: at, createdAt: at,
      }],
    },
    buildRuns: [{
      id: "build-1", revision: 1, status: "succeeded", sourceBranch: "main",
      sourceCommitSha: "abc123", inputSnapshot: {}, gateSummary: {},
      errorCode: null, errorMessage: null, startedAt: at, finishedAt: at,
      createdAt: at, manifest: null,
    }],
    deploy: {
      environment: {
        id: environmentId, key: "staging", status: "active", baselineRole: "staging",
        currentConfigRevision: {
          id: "config-1", projectId: "project-1", environmentId, revision: 2,
          snapshotHash: "a".repeat(64), plainVariables: { API_URL: "https://api.test" },
          secretReferences: [{ id: "secret-1", name: "API", type: "api_key" }],
          resourceReferences: [{
            id: "redis-1", kind: "managed_resource", risk: "medium",
            impact: "shared cache", sharedEnvironmentIds: [environmentId],
          }],
          routeSnapshot: { domains: ["staging.test"] },
          policyReferences: [], createdAt: at,
        },
        serverBindings: [{
          id: "binding-1", status: "active", updatedAt: at,
          server: { id: "server-1", status: "online", updatedAt: at },
        }],
      },
      secrets: [{
        id: "secret-1", projectId: "project-1", environmentId,
        name: "API", type: "api_key", updatedAt: at,
      }],
      resources: [{
        id: "redis-1", kind: "managed_resource", resourceKind: "redis",
        projectId: "project-1", environmentId, status: "active", observedAt: at,
      }],
      deployments: [{
        id: "deploy-1", environmentId, status: "completed", dryRun: false,
        targetType: "server", artifactManifestId: "manifest-1", finishedAt: at, createdAt: at,
      }],
      connections: [{
        id: "connection-1", resourceId: "redis-1", environmentId,
        status: "completed", dryRun: false, finishedAt: at, createdAt: at,
      }],
      metrics: [{
        id: "metric-1", resourceId: "redis-1", environmentId,
        status: "collected", sampledAt: at, raw: { capacityFit: true },
      }],
      backups: [{
        id: "backup-1", resourceId: "redis-1", environmentId,
        status: "completed", dryRun: false, finishedAt: at, createdAt: at,
      }],
    },
  } as unknown as ReleaseGateEvidenceContext;
}
