import { Injectable } from "@nestjs/common";
import { RepositoryGitExecutorService } from "../repository-analysis/repository-git-executor.service";
import { releaseBuildFailureDetail } from "./release-build-failure.utils";
import { buildLogReference, buildLogSummary } from "./release-build-log.utils";
import { ReleaseBuildResultRepository } from "./release-build-result.repository";
import { ReleaseBuildRuntimeProfileService } from "./release-build-runtime-profile.service";
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
    projectId: string;
    releaseOrderId: string;
    source: ReleaseBuildResolvedSource;
    components: ReleaseBuildComponent[];
    signal: AbortSignal;
  }) {
    let checkout: { root: string; cleanup: () => Promise<void> } | undefined;
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
      if (input.signal.aborted) throw input.signal.reason;
      return presentBuild(
        await this.results.succeed({
          buildRunId: input.buildRun.id,
          teamId: input.teamId,
          projectId: input.projectId,
          releaseOrderId: input.releaseOrderId,
          digest: result.artifact.digest,
          uri: result.artifact.uri,
          sizeBytes: result.artifact.sizeBytes,
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
        }),
      );
    } catch (error) {
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
