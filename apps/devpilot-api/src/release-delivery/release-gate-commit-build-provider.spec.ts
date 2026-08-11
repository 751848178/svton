import { ReleaseGateCapabilityRegistryService } from "./release-gate-capability-registry.service";
import type { ReleaseGateCapabilityId } from "./release-gate-catalog.types";
import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import { RELEASE_GATE_DEFINITIONS } from "./release-gate-definition.catalog";
import { createReleaseGateRegistry } from "./release-gate-test-registry.spec-utils";

const NOW = new Date("2026-08-03T08:45:00.000Z");

describe("Commit/Build release gate providers", () => {
  const registry = createReleaseGateRegistry();

  it("reports positive real M01-M05 evidence with freshness metadata", () => {
    const context = evidenceContext();
    const checks = evaluate(registry, context);
    for (const id of [
      "C01",
      "C02",
      "C05",
      "C06",
      "C08",
      "C09",
      "C07",
      "C10",
      "B01",
      "B02",
      "B03",
      "B06",
      "B09",
    ]) {
      expect(checks[id]).toMatchObject({ status: "checked", fresh: true });
      expect(checks[id].evidenceRef).toBeTruthy();
      expect(checks[id].checkedAt).toBeTruthy();
    }
    expect(checks.C03).toMatchObject({ status: "manual", fresh: true });
    expect(checks.C01.expiresAt).toBeTruthy();
    expect(checks.B09.expiresAt).toBeNull();
    expect(
      registry
        .list(context)
        .filter((item) =>
          (
            ["M01", "M02", "M03", "M04", "M05"] as ReleaseGateCapabilityId[]
          ).includes(item.id),
        )
        .every((item) => item.available),
    ).toBe(true);
  });

  it("blocks failed build, security, test, and corrupt Manifest evidence", () => {
    const context = evidenceContext();
    const build = context.buildRuns[0];
    build.status = "failed";
    build.errorCode = "BUILD_COMMAND_FAILED";
    build.gateSummary = {
      build: { status: "failed" },
      tests: { ...buildEvidence("tests"), status: "failed" },
      security: {
        vulnerabilities: {
          ...buildEvidence("vulnerabilities"),
          status: "failed",
        },
      },
    };
    if (build.manifest) build.manifest.digest = "sha256:invalid";
    const checks = evaluate(registry, context);
    expect(checks.B02.status).toBe("blocked");
    expect(checks.B03.status).toBe("blocked");
    expect(checks.B06.status).toBe("blocked");
    expect(checks.B09.status).toBe("blocked");
  });

  it("turns expired source and analysis evidence into unchecked", () => {
    const context = evidenceContext();
    const old = new Date("2026-07-01T00:00:00.000Z");
    context.project.repositoryConnection!.verifiedAt = old;
    context.project.repositoryConnection!.updatedAt = old;
    context.project.repositoryAnalysisRuns[0].finishedAt = old;
    context.buildRuns[0].finishedAt = old;
    const checks = evaluate(registry, context);
    expect(checks.C01).toMatchObject({
      status: "unchecked",
      reasonCode: "evidence_stale",
      fresh: false,
    });
    expect(checks.C05).toMatchObject({
      status: "unchecked",
      reasonCode: "evidence_stale",
      fresh: false,
    });
    expect(checks.C08).toMatchObject({
      status: "unchecked",
      reasonCode: "evidence_stale",
      fresh: false,
    });
  });

  it("keeps missing source state and scanner providers unavailable", () => {
    const context = evidenceContext();
    context.decisionTarget = undefined;
    context.buildRuns[0].gateSummary = { build: { status: "passed" } };
    context.project.repositoryAnalysisRuns[0].result = {
      repository: { monorepo: false },
      services: [{ key: "api" }],
    };
    const checks = evaluate(registry, context);
    expect(checks.C02.reasonCode).toBe("source_state_evidence_missing");
    expect(checks.C03.reasonCode).toBe("source_policy_revision_missing");
    expect(checks.C06.reasonCode).toBe("baseline_diff_evidence_missing");
    expect(checks.C07.status).toBe("unavailable");
    expect(checks.C10.status).toBe("unavailable");
    expect(checks.B06.status).toBe("unavailable");
    expect(
      registry.list(context).find((item) => item.id === "M04"),
    ).toMatchObject({
      available: false,
      providerKey: "build_quality_security",
    });
  });

  it("does not reuse a historical BuildRun when current source resolution fails", () => {
    const context = evidenceContext();
    context.decisionTarget = { sourceResolution: "unavailable" };
    const checks = evaluate(registry, context);
    expect(checks.C01).toMatchObject({
      status: "unavailable",
      reasonCode: "repository_source_resolution_failed",
    });
  });

  it("rejects a stale frozen source policy revision", () => {
    const context = evidenceContext();
    context.project.currentSourcePolicyRevision!.id = "policy-2";
    const checks = evaluate(registry, context);
    expect(checks.C03).toMatchObject({
      status: "unavailable",
      reasonCode: "source_policy_revision_stale",
    });
  });
});

function evaluate(
  registry: ReleaseGateCapabilityRegistryService,
  context: ReleaseGateEvidenceContext,
) {
  return Object.fromEntries(
    RELEASE_GATE_DEFINITIONS.filter(
      (definition) =>
        definition.capabilityId &&
        ["M01", "M02", "M03", "M04", "M05"].includes(definition.capabilityId),
    ).map((definition) => [
      definition.id,
      registry.evaluate(definition, context, NOW),
    ]),
  );
}

function evidenceContext() {
  const at = new Date("2026-08-03T08:00:00.000Z");
  const digest = `sha256:${"a".repeat(64)}`;
  return {
    id: "order-1",
    releaseVersion: "2.4.1",
    project: {
      currentSourcePolicyRevision: {
        id: "policy-1",
        profileId: "controlled-local-acceptance-v2",
        profileVersion: 2,
        externalRequiredChecks: 0,
        requiredIndependentApprovals: 1,
        snapshotHash: "policy-snapshot-hash",
      },
      repositoryConnection: {
        id: "connection-1",
        provider: "github",
        status: "connected",
        defaultBranch: "main",
        selectedBranch: "main",
        commitSha: "abc123",
        verifiedAt: at,
        errorCode: null,
        errorMessage: null,
        updatedAt: at,
      },
      repositoryAnalysisRuns: [
        {
          id: "analysis-1",
          status: "succeeded",
          branch: "main",
          commitSha: "abc123",
          parserVersion: "f402.1",
          result: {
            repository: {
              monorepo: false,
              packageManager: "pnpm",
              lockfiles: ["pnpm-lock.yaml"],
            },
            services: [{ key: "api" }],
            changeImpact: { highRiskDirectories: [] },
          },
          errorCode: null,
          errorMessage: null,
          finishedAt: at,
          createdAt: at,
        },
      ],
    },
    buildRuns: [
      {
        id: "build-1",
        revision: 1,
        status: "succeeded",
        sourceBranch: "main",
        sourceCommitSha: "abc123",
        inputSnapshot: {},
        errorCode: null,
        errorMessage: null,
        gateSummary: {
          source: { status: "passed" },
          install: buildEvidence("install"),
          quality: buildEvidence("quality"),
          build: { status: "passed" },
          tests: buildEvidence("tests"),
          security: {
            secretScan: buildEvidence("secretScan"),
            sast: buildEvidence("sast"),
            vulnerabilities: buildEvidence("vulnerabilities"),
          },
        },
        startedAt: at,
        finishedAt: at,
        createdAt: at,
        manifest: {
          id: "manifest-1",
          digest,
          provenance: {},
          sbom: {},
          signature: {},
          createdAt: at,
          items: [
            { componentKey: "project-bundle", digest, artifactType: "zip" },
          ],
        },
      },
    ],
    decisionTarget: {
      sourceBranch: "main",
      sourceCommitSha: "abc123",
      sourceEvidence: {
        status: "passed",
        reasonCode: "source_state_verified",
        checkedAt: at.toISOString(),
        evidenceRef: "release-evidence://source-abc123/source-state.json",
        evidenceHash: "source-evidence-hash",
        exactCommit: "abc123",
        defaultHead: "abc123",
        baselineCommit: "abc122",
        mergeBase: "abc122",
        ahead: 1,
        behind: 0,
        mergeTreeClean: true,
        changedPaths: ["apps/api/src/main.ts"],
        highRiskPaths: [],
        commitAuthorUserId: "author-1",
        sourcePolicyRevision: {
          id: "policy-1",
          profileId: "controlled-local-acceptance-v2",
          profileVersion: 2,
          externalRequiredChecks: 0,
          requiredIndependentApprovals: 1,
          snapshotHash: "policy-snapshot-hash",
        },
      },
    },
  } as unknown as ReleaseGateEvidenceContext;
}

function buildEvidence(category: string) {
  return {
    status: "passed",
    evidenceRef: `release-evidence://build-1/${category}.json`,
    evidenceHash: `${category}-evidence-hash`,
  };
}
