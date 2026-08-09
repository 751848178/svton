import { check, predicate } from "./parity-e2e-evidence.mjs";
import { createParityComposeCapture } from "./parity-compose-capture.mjs";
import { claimPositiveDeliveryFixture } from "./parity-positive-delivery-fixture-claim.mjs";
import { materializeParityHistoryArtifacts } from "./parity-seed-version-history-artifacts.mjs";

export async function runPositiveDeliveryClaim(options) {
  const compose = checkedCompose(options.root, options.runtime);
  const receipt = await claimPositiveDeliveryFixture({
    prisma: options.prisma,
    teamId: options.teamId,
    projectId: options.projectId,
    stagingEnvId: options.stagingEnvId,
    productionEnvId: options.productionEnvId,
    productionConfigRevisionId: options.productionConfigRevisionId,
    pinnedCommit: options.pinnedCommit,
    capturedAt: new Date(),
    materializeHistory: (ids) =>
      materializeParityHistoryArtifacts(options.root, compose, ids),
  });
  const summary = await options.request(
    "GET",
    `/projects/${options.projectId}/delivery/summary`,
    options.headers,
  );
  const frozenIdentity = await readFrozenIdentity(options);
  return {
    ...receipt,
    summaryProjectId: summary.scope?.projectId,
    repositoryDefaultBranch: summary.repository?.defaultBranch,
    projectType: summary.intake?.projectType,
    architecture: summary.intake?.architecture,
    componentCount: summary.intake?.componentCount,
    frozenIdentity,
  };
}

export function positiveDeliveryClaimChecks(result, expected) {
  return [
    check("sameProject", result.projectId, expected.projectId),
    check("sameSummaryProject", result.summaryProjectId, expected.projectId),
    check("stagingEnvironment", result.stagingEnvId, expected.stagingEnvId),
    check(
      "productionEnvironment",
      result.productionEnvId,
      expected.productionEnvId,
    ),
    check("defaultBranch", result.repositoryDefaultBranch, "main"),
    predicate("projectType", Boolean(result.projectType), result.projectType),
    predicate(
      "architecture",
      Boolean(result.architecture),
      result.architecture,
    ),
    predicate(
      "componentCount",
      result.componentCount > 0,
      result.componentCount,
    ),
    predicate(
      "resourceScopes",
      result.resourceScopes?.every((count) => count === 1),
      result.resourceScopes,
    ),
    check("environmentBindings", result.environmentBindings, 2),
    check("applicationContracts", result.applicationContracts?.length, 2),
    check("priorEnvironmentVersions", result.priorEnvironmentVersions, 4),
    predicate(
      "singleFreshProject",
      result.identityReadback?.[0] === 1 && result.identityReadback?.[1] === 0,
      result.identityReadback,
    ),
    predicate(
      "frozenIntakeIdentity",
      result.identityReadback?.[2] === 1 && result.identityReadback?.[3] === 1,
      result.identityReadback,
    ),
    check(
      "analysisRunIdentity",
      result.frozenIdentity?.finalization?.analysisRunId,
      expected.analysisRunId,
    ),
    check(
      "reviewSnapshotIdentity",
      result.frozenIdentity?.reviewSnapshot?.id,
      expected.reviewSnapshotId,
    ),
    check(
      "reviewSnapshotHash",
      result.frozenIdentity?.reviewSnapshot?.snapshotHash,
      expected.reviewSnapshotHash,
    ),
    check(
      "repositoryIdentity",
      result.frozenIdentity?.project?.repositoryIdentity?.id,
      expected.repositoryIdentityId,
    ),
    check(
      "finalizationProject",
      result.frozenIdentity?.finalization?.resultSnapshot?.projectId,
      expected.projectId,
    ),
    check(
      "finalizationReviewSnapshot",
      result.frozenIdentity?.finalization?.resultSnapshot?.reviewSnapshotId,
      expected.reviewSnapshotId,
    ),
    check(
      "finalizationReviewHash",
      result.frozenIdentity?.finalization?.resultSnapshot?.reviewSnapshotHash,
      expected.reviewSnapshotHash,
    ),
    check(
      "reviewSnapshotProject",
      result.frozenIdentity?.reviewSnapshot?.projectId,
      expected.projectId,
    ),
    check(
      "reviewSnapshotRun",
      result.frozenIdentity?.reviewSnapshot?.runId,
      expected.analysisRunId,
    ),
    check(
      "onboardingStatus",
      result.frozenIdentity?.project?.onboardingStatus,
      "ready",
    ),
    predicate(
      "repositoryRevision",
      Boolean(
        result.frozenIdentity?.project?.repositoryIdentity?.currentRevisionId,
      ),
      result.frozenIdentity?.project?.repositoryIdentity?.currentRevisionId,
    ),
  ];
}

async function readFrozenIdentity(options) {
  const [finalization, reviewSnapshot, project] = await Promise.all([
    options.prisma.projectIntakeFinalization.findFirst({
      where: {
        teamId: options.teamId,
        projectId: options.projectId,
        analysisRunId: options.intakeContext.analysisRunId,
        status: "succeeded",
      },
      select: {
        id: true,
        teamId: true,
        projectId: true,
        analysisRunId: true,
        status: true,
        resultSnapshot: true,
        finishedAt: true,
      },
    }),
    options.prisma.repositoryIntakeReviewSnapshot.findUnique({
      where: { id: options.intakeContext.reviewSnapshotId },
      select: {
        id: true,
        teamId: true,
        projectId: true,
        runId: true,
        snapshotHash: true,
      },
    }),
    options.prisma.project.findUnique({
      where: { id: options.projectId },
      select: {
        id: true,
        onboardingStatus: true,
        onboardingRevision: true,
        onboardingFinalizedAt: true,
        repositoryIdentity: {
          select: { id: true, currentRevisionId: true, lockedAt: true },
        },
      },
    }),
  ]);
  return { finalization, reviewSnapshot, project };
}

function checkedCompose(root, runtime) {
  const capture = createParityComposeCapture(root, runtime);
  return (args) => {
    const result = capture(args);
    if (result.status !== 0) {
      throw new Error(
        `parity compose failed (${args.join(" ")}): ${result.stderr || result.stdout}`,
      );
    }
    return result;
  };
}
