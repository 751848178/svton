import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";

export function commitBuildEvidenceContext() {
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

export function buildEvidence(category: string) {
  return {
    status: "passed",
    evidenceRef: `release-evidence://build-1/${category}.json`,
    evidenceHash: `${category}-evidence-hash`,
  };
}
