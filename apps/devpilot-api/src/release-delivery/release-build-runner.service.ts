import { Injectable } from "@nestjs/common";
import { RepositoryGitExecutorService } from "../repository-analysis/repository-git-executor.service";
import { releaseBuildFailureDetail } from "./release-build-failure.utils";
import { discardUncommittedBuildArtifact } from "./release-build-artifact-cleanup";
import { buildLogReference, buildLogSummary } from "./release-build-log.utils";
import { ReleaseBuildResultRepository } from "./release-build-result.repository";
import { ReleaseBuildRuntimeProfileService } from "./release-build-runtime-profile.service";
import { ReleaseGateDecisionService } from "./release-gate-decision.service";
import { presentBuild } from "./release-build.presenter";
import type {
  ReleaseBuildComponent,
  ReleaseBuildResolvedSource,
} from "./release-build.types";
import { ReleaseBuildExecutorPort } from "./release-build.types";

interface ReservedBuildRun {
  id: string;
  sourceBranch: string;
  sourceCommitSha: string;
  inputHash: string;
}

@Injectable()
export class ReleaseBuildRunnerService {
  constructor(
    private readonly results: ReleaseBuildResultRepository,
    private readonly git: RepositoryGitExecutorService,
    private readonly executor: ReleaseBuildExecutorPort,
    private readonly runtime: ReleaseBuildRuntimeProfileService,
    private readonly gates: ReleaseGateDecisionService,
  ) {}

  async abort(buildRunId: string, signal: AbortSignal) {
    await this.persistFailure(
      buildRunId,
      releaseBuildFailureDetail(signal.reason, signal),
    );
  }

  async run(input: {
    buildRun: ReservedBuildRun;
    teamId: string;
    actorId: string;
    projectId: string;
    releaseOrderId: string;
    source: ReleaseBuildResolvedSource;
    components: ReleaseBuildComponent[];
    signal: AbortSignal;
  }) {
    let checkout: { root: string; cleanup: () => Promise<void> } | undefined;
    let artifactPackaged = false;
    let artifactCommitted = false;
    let persistenceStarted = false;
    let artifactDigest = "";
    try {
      checkout = await this.git.checkout(
        input.source.connection.repositoryUrl,
        input.source.identity.branch,
        input.source.commitSha,
        input.source.credential,
        input.signal,
        { root: this.runtime.workRoot, prefix: "devpilot-release-build-" },
      );
      const result = await this.executor.execute(
        {
          buildRunId: input.buildRun.id,
          projectId: input.projectId,
          releaseOrderId: input.releaseOrderId,
          checkoutRoot: checkout.root,
          components: input.components,
        },
        input.signal,
      );
      artifactPackaged = true;
      artifactDigest = result.artifact.digest;
      if (input.signal.aborted) throw input.signal.reason;
      await this.results.recordCandidateEvidence({
        buildRunId: input.buildRun.id,
        logReference: buildLogReference(input.buildRun.id),
        logSummary: buildLogSummary(result.logs),
        gateSummary: result.gateSummary,
      });
      const postDecision = await this.gates.assertAllowed({
        teamId: input.teamId,
        actorId: input.actorId,
        projectId: input.projectId,
        releaseOrderId: input.releaseOrderId,
        checkpoint: "build_post_execution",
        target: {
          buildRunId: input.buildRun.id,
          sourceBranch: input.buildRun.sourceBranch,
          sourceCommitSha: input.buildRun.sourceCommitSha,
        },
        actionInput: {
          buildRunId: input.buildRun.id,
          inputHash: input.buildRun.inputHash,
          sourceCommitSha: input.buildRun.sourceCommitSha,
        },
        requestKey: `post:build:${input.buildRun.id}:${input.buildRun.inputHash}`,
      });
      persistenceStarted = true;
      const persisted = await this.results.succeed({
        buildRunId: input.buildRun.id,
        teamId: input.teamId,
        projectId: input.projectId,
        releaseOrderId: input.releaseOrderId,
        digest: result.artifact.digest,
        uri: result.artifact.uri,
        sizeBytes: result.artifact.sizeBytes,
        items: result.artifact.items,
        contentIndex: result.artifact.contentIndex,
        sourceBranch: input.buildRun.sourceBranch,
        sourceCommitSha: input.buildRun.sourceCommitSha,
        inputHash: input.buildRun.inputHash,
        repositoryIdentityId: input.source.identity.id,
        repositoryIdentityRevisionId: input.source.identity.revisionId,
        repositoryProvider: input.source.identity.provider,
        canonicalRepositoryUrl: input.source.identity.canonicalUrl,
        logReference: buildLogReference(input.buildRun.id),
        logSummary: buildLogSummary(result.logs),
        gateSummary: result.gateSummary,
        actorId: input.actorId,
        gateDecision: {
          id: postDecision.id,
          stage: postDecision.stage,
          inputHash: postDecision.inputHash,
        },
      });
      artifactCommitted = true;
      return presentBuild(persisted);
    } catch (error) {
      if (artifactPackaged && !artifactCommitted) {
        await discardUncommittedBuildArtifact({
          results: this.results,
          executor: this.executor,
          projectId: input.projectId,
          releaseOrderId: input.releaseOrderId,
          buildRunId: input.buildRun.id,
          digest: artifactDigest,
          persistenceStarted,
          error,
        });
      }
      return this.persistFailure(
        input.buildRun.id,
        releaseBuildFailureDetail(error, input.signal),
      );
    } finally {
      if (checkout) {
        try {
          await checkout.cleanup();
        } catch {
          // Cleanup evidence must not replace an already persisted outcome.
        }
      }
    }
  }

  private async persistFailure(
    buildRunId: string,
    detail: ReturnType<typeof releaseBuildFailureDetail>,
  ) {
    return presentBuild(
      await this.results.fail({
        buildRunId,
        code: detail.code,
        message: detail.message,
        logReference: buildLogReference(buildRunId),
        logSummary: buildLogSummary(detail.logs),
        gateSummary: detail.gateSummary,
        status: detail.status,
      }),
    );
  }
}
