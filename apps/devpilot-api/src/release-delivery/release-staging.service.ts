import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { sanitizeBuildLogs } from "./release-build-log.utils";
import { ReleaseDeploymentInputService } from "./release-deployment-input.service";
import { ReleaseStagingRepository } from "./release-staging.repository";
import {
  scopedStagingDeployment,
  stagingFailureDetail,
} from "./release-staging-presentation.utils";
import { ReleaseStagingExecutorPort } from "./release-staging.types";
import { ReleaseGateDecisionService } from "./release-gate-decision.service";
import { requireDeployableStagingManifest } from "./release-staging-manifest.policy";

@Injectable()
export class ReleaseStagingService {
  constructor(
    private readonly repository: ReleaseStagingRepository,
    private readonly executor: ReleaseStagingExecutorPort,
    private readonly gates: ReleaseGateDecisionService,
    private readonly inputs: ReleaseDeploymentInputService,
  ) {}

  async list(teamId: string, projectId: string, releaseOrderId: string) {
    await this.requireContext(teamId, projectId, releaseOrderId);
    const items = await this.repository.list(teamId, projectId, releaseOrderId);
    return {
      items: items.map((item) =>
        scopedStagingDeployment(item, projectId, releaseOrderId),
      ),
      total: items.length,
    };
  }

  async deploy(input: {
    teamId: string;
    actorId: string;
    projectId: string;
    releaseOrderId: string;
    manifestId: string;
  }) {
    const context = await this.requireContext(
      input.teamId,
      input.projectId,
      input.releaseOrderId,
    );
    if (context.project.environments.length !== 1) {
      throw new UnprocessableEntityException(
        "项目必须有且仅有一个活动 Staging 基线",
      );
    }
    const { manifest, item } = requireDeployableStagingManifest(
      await this.repository.manifest(
        input.teamId,
        input.projectId,
        input.releaseOrderId,
        input.manifestId,
      ),
      input,
    );
    const environment = context.project.environments[0];
    const decision = await this.gates.assertAllowed({
      teamId: input.teamId,
      actorId: input.actorId,
      projectId: input.projectId,
      releaseOrderId: input.releaseOrderId,
      stage: "staging",
      target: {
        buildRunId: manifest.buildRun.id,
        manifestId: manifest.id,
        environmentId: environment.id,
        configRevisionId: environment.currentConfigRevisionId,
      },
      actionInput: {
        buildRunId: manifest.buildRun.id,
        manifestId: manifest.id,
        manifestDigest: manifest.digest,
        environmentId: environment.id,
        configRevisionId: environment.currentConfigRevisionId,
      },
    });
    const deploymentInput = await this.inputs.prepare({
      teamId: input.teamId,
      projectId: input.projectId,
      environmentId: environment.id,
      providerKey: this.executor.providerKey,
    });
    const run = await this.repository.create({
      teamId: input.teamId,
      actorId: input.actorId,
      projectId: input.projectId,
      releaseOrderId: input.releaseOrderId,
      environmentId: environment.id,
      configRevisionId: environment.currentConfigRevisionId,
      manifestId: manifest.id,
      sourceBranch: manifest.buildRun.sourceBranch,
      sourceCommitSha: manifest.buildRun.sourceCommitSha,
      params: {
        version: 1,
        releaseOrderId: input.releaseOrderId,
        manifestId: manifest.id,
        manifestDigest: manifest.digest,
        buildRunId: manifest.buildRun.id,
        environmentId: environment.id,
        configRevisionId: environment.currentConfigRevisionId,
        deploymentProvider: {
          key: this.executor.providerKey,
          targetRef: deploymentInput.snapshot.target.targetRef,
        },
        deploymentInput: deploymentInput.snapshot,
        gateDecision: {
          id: decision.id,
          stage: decision.stage,
          inputHash: decision.inputHash,
        },
      },
      providerKey: this.executor.providerKey,
      deploymentInput: deploymentInput.snapshot,
      gateDecision: {
        id: decision.id,
        stage: decision.stage,
        inputHash: decision.inputHash,
      },
    });
    try {
      const result = await this.executor.deploy({
        deploymentRunId: run.id,
        stage: "staging",
        projectId: input.projectId,
        releaseOrderId: input.releaseOrderId,
        environmentId: environment.id,
        manifestId: manifest.id,
        buildRunId: manifest.buildRun.id,
        uri: item.uri,
        digest: manifest.digest,
        deploymentInput: deploymentInput.snapshot,
        runtimeEnvironment: deploymentInput.runtimeEnvironment,
        targetConnection: deploymentInput.targetConnection,
      });
      return scopedStagingDeployment(
        await this.repository.finish({
          deploymentRunId: run.id,
          status: "completed",
          logs: sanitizeBuildLogs(result.logs),
          result: {
            ...result.evidence,
            deploymentUri: result.deploymentUri,
            manifestId: manifest.id,
            manifestDigest: manifest.digest,
          },
        }),
        input.projectId,
        input.releaseOrderId,
      );
    } catch (error) {
      const detail = stagingFailureDetail(error);
      return scopedStagingDeployment(
        await this.repository.finish({
          deploymentRunId: run.id,
          status: "failed",
          logs: detail.logs,
          error: `${detail.code}: ${detail.message}`,
          result: { manifestId: manifest.id, manifestDigest: manifest.digest },
        }),
        input.projectId,
        input.releaseOrderId,
      );
    }
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
