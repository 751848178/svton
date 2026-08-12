import { RELEASE_GATE_DEFINITIONS } from "./release-gate-definition.catalog";
import { ReleaseGateProductionApplicabilityProvider } from "./release-gate-production-applicability.provider";

describe("ReleaseGateProductionApplicabilityProvider", () => {
  const provider = new ReleaseGateProductionApplicabilityProvider();
  const now = new Date("2026-08-11T04:00:00.000Z");

  it("does not alter catalog evaluations without a server checkpoint", () => {
    expect(provider.evaluate(gate("D06"), context(), now)).toBeNull();
  });

  it("marks exact standard strategy capabilities not applicable", () => {
    const value = context("production_pre_execution");
    expect(provider.evaluate(gate("D06"), value, now)).toMatchObject({
      status: "checked",
      reasonCode: "d06_not_applicable_standard_strategy",
    });
    value.decisionTarget!.bindingId = "missing-binding";
    expect(provider.evaluate(gate("D06"), value, now)).toMatchObject({
      status: "unavailable",
      reasonCode: "standard_single_host_fact_missing",
    });
    value.decisionTarget!.bindingId = "binding-1";
    value.promote!.releaseRun!.policySnapshot = { releasePolicy: { strategy: "advanced" } };
    expect(provider.evaluate(gate("D06"), value, now)).toMatchObject({
      status: "unavailable",
      reasonCode: "standard_strategy_fact_missing",
    });
  });

  it("ignores a stale fallback run and uses the exact frozen first-release preview", () => {
    const value = context("production_pre_execution");
    delete value.decisionTarget!.releaseRunId;
    expect(provider.evaluate(gate("D06"), value, now)).toMatchObject({
      status: "checked",
      reasonCode: "d06_not_applicable_standard_strategy",
      evidenceIdentity: {
        releaseRunId: null,
        previewInputHash: "preview-hash",
        environmentId: "environment-1",
        providerKey: "ssh-v1",
        bindingId: "binding-1",
      },
    });
    expect(provider.evaluate(gate("D19"), value, now)).toMatchObject({
      status: "checked",
      reasonCode: "rollback_not_applicable_first_release",
      evidenceIdentity: { currentVersionId: null, historyCount: 0,
        releaseRunId: null },
    });
    value.decisionTarget!.releaseRunId = "different-release";
    expect(provider.evaluate(gate("D06"), value, now)).toMatchObject({
      status: "unavailable", reasonCode: "standard_strategy_fact_missing",
    });
    expect(provider.evaluate(gate("D19"), value, now)).toMatchObject({
      status: "unavailable", reasonCode: "first_release_fact_missing",
    });
    delete value.decisionTarget!.releaseRunId;
    value.decisionCheckpoint = "production_post_deploy";
    expect(provider.evaluate(gate("D06"), value, now)).toMatchObject({
      status: "unavailable",
      reasonCode: "standard_strategy_fact_missing",
    });
    expect(provider.evaluate(gate("D19"), value, now)).toMatchObject({
      status: "unavailable",
      reasonCode: "first_release_fact_missing",
    });
    value.decisionTarget!.releaseRunId = "different-release";
    expect(provider.evaluate(gate("D06"), value, now)).toMatchObject({
      status: "unavailable",
      reasonCode: "standard_strategy_fact_missing",
    });
  });

  it("accepts only an exact known single-host binding for D09", () => {
    const value = context("production_pre_execution");
    expect(provider.evaluate(gate("D09"), value, now)).toMatchObject({
      status: "checked",
      reasonCode: "network_policy_not_applicable_single_host",
    });
    value.decisionTarget!.providerKey = "unknown-v1";
    expect(provider.evaluate(gate("D09"), value, now)).toMatchObject({
      status: "unavailable",
      reasonCode: "network_policy_provider_missing",
    });
  });

  it("handles first release and the single current rollback candidate", () => {
    const first = context("production_pre_execution");
    expect(provider.evaluate(gate("D19"), first, now)).toMatchObject({
      status: "checked",
      reasonCode: "rollback_not_applicable_first_release",
    });
    const candidate = version();
    first.promote!.environment!.currentEnvironmentVersion = {
      id: candidate.id,
      artifactManifestId: candidate.artifactManifestId,
      deploymentRunId: candidate.deploymentRunId,
      releaseRunId: "prior-release",
      effectiveAt: candidate.effectiveAt,
    };
    first.promote!.environment!.environmentVersions = [candidate];
    expect(provider.evaluate(gate("D19"), first, now)).toMatchObject({
      status: "checked",
      reasonCode: "current_stable_artifact_recoverable",
      evidenceIdentity: {
        versionId: "version-1", deploymentRunId: "deployment-1",
        deploymentStatus: "completed", deploymentDryRun: "false",
        manifestId: "manifest-1", manifestItemCount: 1,
      },
    });
  });

  it("requires a strict exact-commit stateless inventory for D20", () => {
    const value = context("production_pre_execution");
    expect(provider.evaluate(gate("D20"), value, now)).toMatchObject({
      status: "checked",
      reasonCode: "recovery_compatibility_not_applicable_stateless",
    });
    (value.project.repositoryAnalysisRuns[0].result as any).migrationEvidence.detectedFiles = ["db/schema.sql"];
    expect(provider.evaluate(gate("D20"), value, now)).toMatchObject({
      status: "unavailable",
      reasonCode: "recovery_compatibility_provider_missing",
    });
  });

  it("uses exact frozen facts for D08, D12 and HTTP-only D15", () => {
    const value = context("production_pre_execution");
    Object.assign(value.decisionTarget!, {
      configRevisionId: "revision-1",
      buildRunId: "build-1",
      manifestId: "manifest-1",
      deploymentInputHash: "deployment-hash",
      workloadInputHash: "workload-hash",
    });
    value.deploy!.environment!.currentConfigRevision = {
      id: "revision-1",
      snapshotHash: "config-hash",
      resourceReferences: [],
      routeSnapshot: {
        tlsRequired: false,
        entries: [{ tlsMode: "none" }],
      },
      createdAt: new Date("2026-08-11T03:00:00.000Z"),
    };
    expect(provider.evaluate(gate("D08"), value, now)).toMatchObject({
      status: "checked",
      reasonCode: "resource_connectivity_not_applicable_zero_resources",
    });
    expect(provider.evaluate(gate("D12"), value, now)).toMatchObject({
      status: "checked",
      reasonCode: "backup_not_applicable_stateless_without_resources",
    });
    expect(provider.evaluate(gate("D15"), value, now)).toMatchObject({
      status: "checked",
      reasonCode: "tls_not_applicable_frozen_http_route",
      evidenceIdentity: {
        deploymentInputHash: "deployment-hash",
        workloadInputHash: "workload-hash",
      },
    });
    value.decisionTarget!.workloadInputHash = undefined;
    expect(provider.evaluate(gate("D08"), value, now)).toMatchObject({
      status: "unavailable",
      reasonCode: "production_applicability_frozen_fact_missing",
    });
  });

  it("does not mark stateful resource instances or managed TLS routes N/A", () => {
    const value = context("production_pre_execution");
    Object.assign(value.decisionTarget!, {
      configRevisionId: "revision-1",
      deploymentInputHash: "deployment-hash",
      workloadInputHash: "workload-hash",
    });
    value.deploy!.environment!.currentConfigRevision = {
      id: "revision-1",
      snapshotHash: "config-hash",
      resourceReferences: [{
        id: "db-1",
        kind: "resource_instance",
        resourceTypeKey: "mysql",
        resourceTypeCategory: "database",
        stateful: true,
      }],
      routeSnapshot: {
        tlsRequired: true,
        entries: [{ tlsMode: "managed_cert" }],
      },
      createdAt: new Date("2026-08-11T03:00:00.000Z"),
    };
    expect(provider.evaluate(gate("D08"), value, now)).toBeNull();
    expect(provider.evaluate(gate("D12"), value, now)).toBeNull();
    expect(provider.evaluate(gate("D15"), value, now)).toBeNull();

    delete value.deploy!.environment!.currentConfigRevision.resourceReferences[0].stateful;
    expect(provider.evaluate(gate("D12"), value, now)).toMatchObject({
      status: "unavailable",
      reasonCode: "resource_reference_snapshot_invalid",
    });
  });
});

function gate(id: string) {
  return RELEASE_GATE_DEFINITIONS.find((item) => item.id === id)!;
}

function context(checkpoint?: "production_pre_execution") {
  const createdAt = new Date("2026-08-11T03:00:00.000Z");
  return {
    id: "order-1",
    projectId: "project-1",
    releaseVersion: "1.0.0",
    decisionCheckpoint: checkpoint,
    decisionTarget: {
      environmentId: "environment-1",
      providerKey: "ssh-v1",
      bindingId: "binding-1",
      releaseStrategy: "standard",
      requireProductionApproval: true,
      previewInputHash: "preview-hash",
      releaseRunId: "release-1",
    },
    project: {
      repositoryConnection: null,
      repositoryAnalysisRuns: [{
        id: "analysis-1",
        status: "succeeded",
        commitSha: "commit-1",
        result: { migrationEvidence: {
          providerKey: "repository_inventory_v1",
          applicable: false,
          reasonCode: "no_schema_or_migration_surface",
          detectedFiles: [],
          commandServices: [],
          databaseKinds: [],
        } },
        finishedAt: createdAt,
        createdAt,
      }],
    },
    buildRuns: [{ id: "build-1", sourceCommitSha: "commit-1" }],
    deploy: {
      environment: {
        id: "environment-1",
        serverBindings: [{ id: "binding-1", updatedAt: createdAt }],
      },
    },
    promote: {
      environment: {
        id: "environment-1",
        currentEnvironmentVersion: null,
        environmentVersions: [],
      },
      releaseRun: {
        id: "release-1",
        createdAt,
        policySnapshot: {
          releasePolicy: { strategy: "standard", requireProductionApproval: true },
        },
      },
    },
  } as any;
}

function version() {
  const effectiveAt = new Date("2026-08-10T03:00:00.000Z");
  return {
    id: "version-1",
    artifactManifestId: "manifest-1",
    deploymentRunId: "deployment-1",
    previousVersionId: null,
    effectiveAt,
    artifactManifest: {
      id: "manifest-1",
      digest: `sha256:${"a".repeat(64)}`,
      items: [{ id: "item-1", digest: `sha256:${"b".repeat(64)}` }],
    },
    deploymentRun: { id: "deployment-1", status: "completed", dryRun: false },
  };
}
