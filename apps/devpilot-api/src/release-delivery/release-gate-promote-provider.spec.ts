import { ReleaseGateCapabilityRegistryService } from "./release-gate-capability-registry.service";
import type { ReleaseGateCapabilityId } from "./release-gate-catalog.types";
import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import { RELEASE_GATE_DEFINITIONS } from "./release-gate-definition.catalog";
import { createReleaseGateRegistry } from "./release-gate-test-registry.spec-utils";

const NOW = new Date("2026-08-03T09:30:00.000Z");

describe("Promote release gate providers", () => {
  const registry = createReleaseGateRegistry();

  it("reports real technical M10-M14 evidence and keeps business validation manual", () => {
    const context = evidenceContext();
    const checks = evaluate(registry, context);
    for (const id of ["D13", "D14", "D15", "D16", "D17", "D18", "D19", "D20", "P01", "P02", "P04", "P10"]) {
      expect(checks[id]).toMatchObject({ status: "checked", fresh: true });
      expect(checks[id].evidenceRef).toBeTruthy();
    }
    expect(checks.P03).toMatchObject({
      status: "unavailable", reasonCode: "business_validation_target_missing",
    });
    expect(checks.D06.status).toBe("unavailable");
    expect(checks.P08.reasonCode).toBe("traffic_strategy_provider_missing");
    const states = registry.list(context);
    expect(states.filter((item) =>
      (["M10", "M11", "M12", "M13", "M14"] as ReleaseGateCapabilityId[]).includes(item.id),
    ).every((item) => item.available)).toBe(true);
    expect(states.find((item) => item.id === "M15")?.available).toBe(false);
  });

  it("blocks approval drift, ownership errors, failed probes, bad metrics, and corrupt recovery", () => {
    const context = evidenceContext();
    const promote = context.promote!;
    promote.releaseRun!.operationApproval!.inputHash = "drift";
    promote.sites[0].environmentId = "other-env";
    promote.sites[0].tls = { status: "valid", expiresAt: "2026-07-01T00:00:00.000Z" };
    promote.releaseRun!.deploymentRuns[0].result = {
      healthProbe: { status: "failed" },
      httpProbe: { status: "failed" },
      recoveryCompatibility: { status: "failed" },
    };
    promote.metrics[0].raw = {
      observability: { metrics: false, traces: true, alerts: true },
      promotionMetrics: { status: "failed" },
    };
    promote.environment!.environmentVersions[1].artifactManifest.digest = "invalid";
    const checks = evaluate(registry, context);
    expect(checks.D13.reasonCode).toBe("approval_input_drift");
    expect(checks.D14.reasonCode).toBe("site_environment_mismatch");
    expect(checks.D15.status).toBe("blocked");
    expect(checks.D17.status).toBe("blocked");
    expect(checks.P02.status).toBe("blocked");
    expect(checks.D18.status).toBe("blocked");
    expect(checks.P04.status).toBe("blocked");
    expect(checks.D19.status).toBe("blocked");
    expect(checks.D20.status).toBe("blocked");
  });

  it("expires DNS, HTTP, observability, promotion metrics, and approval evidence", () => {
    const context = evidenceContext();
    const old = new Date("2026-07-01T00:00:00.000Z");
    const promote = context.promote!;
    promote.sites[0].lastSyncAt = old;
    (promote.sites[0].dns as { checkedAt: string }).checkedAt = old.toISOString();
    ((promote.sites[0].tls as { probe: { checkedAt: string } }).probe)
      .checkedAt = old.toISOString();
    promote.releaseRun!.deploymentRuns[0].finishedAt = old;
    promote.logRuns[0].finishedAt = old;
    promote.metrics[0].sampledAt = old;
    promote.releaseRun!.operationApproval!.expiresAt = old;
    const checks = evaluate(registry, context);
    expect(checks.D13).toMatchObject({ status: "blocked", reasonCode: "approval_expired" });
    expect(checks.D14).toMatchObject({
      status: "unavailable", reasonCode: "dns_probe_missing",
    });
    for (const id of ["D15", "D16", "P02", "D18", "P04"]) {
      expect(checks[id]).toMatchObject({
        status: "unchecked", reasonCode: "evidence_stale", fresh: false,
      });
    }
  });

  it("keeps missing providers unavailable while frozen ingress without a Site stays unchecked", () => {
    const context = evidenceContext();
    const promote = context.promote!;
    promote.sites = [];
    promote.environment!.currentConfigRevision!.routeSnapshot = {};
    promote.releaseRun!.deploymentRuns[0].healthCheckUrl = null;
    promote.releaseRun!.deploymentRuns[0].result = {};
    promote.logRuns = [];
    promote.metrics = [];
    promote.environment!.environmentVersions = [promote.environment!.environmentVersions[0]];
    const checks = evaluate(registry, context);
    for (const id of ["D14", "D15", "D17", "D18", "D19", "D20", "P02", "P04", "P08"]) {
      expect(checks[id].status).toBe("unavailable");
    }
    expect(checks.D16).toMatchObject({
      status: "unchecked",
      reasonCode: "site_not_found",
    });
    expect(checks.P03.status).toBe("unavailable");
  });

  it("binds P03 to the exact decision deployment instead of the newest run", () => {
    const context = evidenceContext();
    const release = context.promote!.releaseRun!;
    const exact = release.deploymentRuns[0];
    exact.result = {
      ...(exact.result as Record<string, unknown>),
      productionCandidate: { candidateHash: "candidate-exact" },
    };
    release.deploymentRuns.unshift({
      ...exact,
      id: "deploy-newest-other",
      createdAt: new Date("2026-08-03T09:29:30.000Z"),
    });
    context.decisionCheckpoint = "production_promote_pre_route";
    context.decisionTarget = {
      releaseRunId: release.id,
      deploymentRunId: exact.id,
      candidateHash: "candidate-exact",
    };
    const p03 = evaluate(registry, context).P03;
    expect(p03).toMatchObject({
      status: "manual",
      evidenceRef: `deployment-run:${exact.id}#business-validation`,
      evidenceIdentity: {
        releaseRunId: release.id,
        deploymentRunId: exact.id,
        candidateHash: "candidate-exact",
      },
    });
  });
});

function evaluate(
  registry: ReleaseGateCapabilityRegistryService,
  context: ReleaseGateEvidenceContext,
) {
  return Object.fromEntries(RELEASE_GATE_DEFINITIONS
    .filter((definition) => definition.capabilityId
      && ["M10", "M11", "M12", "M13", "M14", "M15"].includes(definition.capabilityId))
    .map((definition) => [definition.id, registry.evaluate(definition, context, NOW)]));
}

function evidenceContext() {
  const at = new Date("2026-08-03T09:29:00.000Z");
  const env = "production-1";
  const digest = `sha256:${"b".repeat(64)}`;
  const previousDigest = `sha256:${"c".repeat(64)}`;
  const deployment = {
    id: "deploy-2", environmentId: env, status: "completed", dryRun: false,
    artifactManifestId: "manifest-2", healthCheckUrl: "https://prod.test/health",
    result: {
      healthProbe: { status: "passed" }, httpProbe: { status: "passed" },
      workloadReady: { status: "passed" },
      recoveryCompatibility: { status: "passed" },
    },
    finishedAt: at, createdAt: at,
  };
  return {
    id: "order-1", projectId: "project-1", releaseVersion: "2.4.1",
    project: { repositoryConnection: null, repositoryAnalysisRuns: [] },
    buildRuns: [],
    promote: {
      environment: {
        id: env,
        currentConfigRevision: {
          id: "config-1",
          routeSnapshot: { domains: ["prod.test"], proxyTarget: "http://upstream" },
          createdAt: at,
        },
        currentEnvironmentVersion: {
          id: "version-2", artifactManifestId: "manifest-2",
          deploymentRunId: "deploy-2", releaseRunId: "release-1", effectiveAt: at,
        },
        environmentVersions: [
          {
            id: "version-2", artifactManifestId: "manifest-2", deploymentRunId: "deploy-2",
            previousVersionId: "version-1", effectiveAt: at,
            artifactManifest: { id: "manifest-2", digest, items: [{ id: "item-2", digest }] },
            deploymentRun: { id: "deploy-2", status: "completed", dryRun: false },
          },
          {
            id: "version-1", artifactManifestId: "manifest-1", deploymentRunId: "deploy-1",
            previousVersionId: null, effectiveAt: new Date("2026-08-02T09:00:00.000Z"),
            artifactManifest: {
              id: "manifest-1", digest: previousDigest,
              items: [{ id: "item-1", digest: previousDigest }],
            },
            deploymentRun: { id: "deploy-1", status: "completed", dryRun: false },
          },
        ],
      },
      releaseRun: {
        id: "release-1", environmentId: env, artifactManifestId: "manifest-2",
        mode: "standard", status: "succeeded", inputHash: "hash-1",
        policySnapshot: {
          releaseProtection: { changeWindowVerified: true, freezeVerified: true },
        },
        routeSnapshot: {
          domains: ["prod.test"],
          proxyTarget: "http://upstream",
        },
        finishedAt: at, createdAt: at,
        operationApproval: {
          id: "approval-1", projectId: "project-1", environmentId: env,
          status: "approved", inputHash: "hash-1", reviewedAt: at,
          consumedAt: at, expiresAt: null,
        },
        deploymentRuns: [deployment],
      },
      sites: [{
        id: "site-1", environmentId: env, status: "active", primaryDomain: "prod.test",
        tls: { status: "valid", expiresAt: "2027-08-03T00:00:00.000Z",
          probe: { status: "valid", host: "prod.test", servername: "prod.test",
            checkedAt: at.toISOString() } },
        dns: {
          status: "resolved", hostname: "prod.test", records: ["198.18.11.9"],
          checkedAt: at.toISOString(),
        },
        lastSyncAt: at, updatedAt: at,
      }],
      alerts: [],
      logRuns: [{
        id: "logs-1", environmentId: env, status: "completed", dryRun: false,
        result: {}, ingestedEntryCount: 10, finishedAt: at, createdAt: at,
      }],
      metrics: [{
        id: "metric-1", environmentId: env, status: "collected", sampledAt: at,
        raw: {
          observability: { metrics: true, traces: true, alerts: true },
          promotionMetrics: { status: "stable", errorRate: 0, latencyMs: 20 },
        },
      }],
    },
  } as unknown as ReleaseGateEvidenceContext;
}
