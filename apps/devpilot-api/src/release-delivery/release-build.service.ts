import { Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { redactRepositoryText } from "../repository-analysis/repository-analysis-redact.utils";
import { buildComponents } from "./release-build-config.utils";
import { admitReleaseBuild } from "./release-build-gate-admission";
import { ReleaseBuildRepository } from "./release-build.repository";
import { ReleaseBuildRunnerService } from "./release-build-runner.service";
import { ReleaseBuildRuntimeProfileService } from "./release-build-runtime-profile.service";
import { ReleaseBuildRuntimeSupervisorService } from "./release-build-runtime-supervisor.service";
import { presentBuild } from "./release-build.presenter";
import { ReleaseBuildSourceResolverService } from "./release-build-source-resolver.service";
import { ReleaseGateDecisionService } from "./release-gate-decision.service";
import type { ReleaseBuildInputSnapshotV4 } from "./release-build.types";

@Injectable()
export class ReleaseBuildService {
  constructor(
    private readonly repository: ReleaseBuildRepository,
    private readonly sources: ReleaseBuildSourceResolverService,
    private readonly gates: ReleaseGateDecisionService,
    private readonly runner: ReleaseBuildRunnerService,
    private readonly runtime: ReleaseBuildRuntimeProfileService,
    private readonly supervisor: ReleaseBuildRuntimeSupervisorService,
  ) {}

  async list(teamId: string, projectId: string, releaseOrderId: string) {
    await this.requireContext(teamId, projectId, releaseOrderId);
    const items = await this.repository.list(teamId, projectId, releaseOrderId);
    return { items: items.map(presentBuild), total: items.length };
  }

  async build(
    teamId: string,
    actorId: string,
    projectId: string,
    releaseOrderId: string,
  ) {
    this.runtime.assertAvailable();
    return this.supervisor.run(async (scope) => {
      const { source, decision } = await admitReleaseBuild(
        this.sources,
        this.gates,
        { teamId, actorId, projectId, releaseOrderId },
        scope.signal,
      );
      const snapshot: ReleaseBuildInputSnapshotV4 = {
        version: 4,
        repositoryUrl: safeRepositoryUrl(source.connection.repositoryUrl),
        repositoryIdentity: {
          id: source.identity.id,
          revisionId: source.identity.revisionId,
          revision: source.identity.revision,
          provider: source.identity.provider,
          canonicalUrl: source.identity.canonicalUrl,
        },
        sourceBranch: source.identity.branch,
        sourceCommitSha: source.commitSha,
        components: buildComponents(source.context.project.applications),
        gateDecision: {
          id: decision.id,
          stage: decision.stage,
          inputHash: decision.inputHash,
        },
        runtime: this.runtime.descriptor(),
        artifactContract: {
          version: 1,
          collection: "declared-outputs-only",
          environment: "explicit-public-build-values",
        },
      };
      const buildRun = await this.repository.reserve({
        teamId,
        actorId,
        projectId,
        releaseOrderId,
        snapshot,
        inputHash: hashSnapshot(snapshot),
        expectedCanonicalKey: source.identity.canonicalKey,
      });
      await scope.bind(buildRun.id, (signal) =>
        this.runner.abort(buildRun.id, signal),
      );
      return this.runner.run({
        buildRun,
        teamId,
        projectId,
        releaseOrderId,
        source,
        components: snapshot.components,
        signal: scope.signal,
      });
    });
  }

  private async requireContext(
    teamId: string,
    projectId: string,
    releaseOrderId: string,
  ) {
    const context = await this.repository.context(
      teamId,
      projectId,
      releaseOrderId,
    );
    if (!context) throw new NotFoundException("发布单不存在或不属于当前项目");
    return context;
  }
}

function hashSnapshot(snapshot: ReleaseBuildInputSnapshotV4) {
  const { gateDecision, ...stable } = snapshot;
  const input = {
    ...stable,
    gateDecision: gateDecision
      ? { stage: gateDecision.stage, inputHash: gateDecision.inputHash }
      : undefined,
  };
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function safeRepositoryUrl(value: string) {
  return redactRepositoryText(value);
}
