import { Injectable } from "@nestjs/common";
import { ReleaseBuildArtifactService } from "./release-build-artifact.service";
import {
  ReleaseDeploymentProviderError,
  ReleaseDeploymentProviderPort,
} from "./release-deployment-provider.types";
import {
  ReleaseStagingExecutionError,
  ReleaseStagingExecutorPort,
  StagingArtifactInput,
} from "./release-staging.types";

@Injectable()
export class LocalReleaseStagingExecutorService extends ReleaseStagingExecutorPort {
  constructor(
    private readonly artifacts: ReleaseBuildArtifactService,
    private readonly provider: ReleaseDeploymentProviderPort,
  ) {
    super();
  }

  get providerKey() {
    return this.provider.key;
  }

  get providerTargetRef() {
    return this.provider.targetRef;
  }

  async deploy(input: StagingArtifactInput) {
    const artifact = await this.artifacts.resolveAndVerify({
      projectId: input.projectId,
      releaseOrderId: input.releaseOrderId,
      buildRunId: input.buildRunId,
      uri: input.uri,
      digest: input.digest,
    });
    try {
      const receipt = await this.provider.deployExactManifest({
        deploymentRunId: input.deploymentRunId,
        stage: input.stage,
        projectId: input.projectId,
        releaseOrderId: input.releaseOrderId,
        environmentId: input.environmentId,
        targetRef:
          input.deploymentInput?.target.targetRef || this.providerTargetRef,
        manifest: {
          id: input.manifestId,
          buildRunId: input.buildRunId,
          uri: input.uri,
          digest: input.digest,
        },
        artifact,
        globalEnvironment: input.globalEnvironment,
        componentEnvironments: input.componentEnvironments,
        targetConnection: input.targetConnection,
        workload: input.workload,
      });
      assertReceipt(
        input,
        this.providerKey,
        input.deploymentInput?.target.targetRef || this.providerTargetRef,
        receipt,
      );
      return {
        deploymentUri: receipt.deploymentUri,
        logs: receipt.logs,
        evidence: {
          ...receipt.evidence,
          providerKey: receipt.providerKey,
          providerDeploymentId: receipt.providerDeploymentId,
          providerTargetRef: receipt.targetRef,
          providerActivatedAt: receipt.activatedAt,
          artifactVerified: true,
          immutableInput: true,
        },
      };
    } catch (error) {
      if (error instanceof ReleaseStagingExecutionError) throw error;
      if (error instanceof ReleaseDeploymentProviderError) {
        throw new ReleaseStagingExecutionError(error.detail);
      }
      throw error;
    }
  }
}

function assertReceipt(
  input: StagingArtifactInput,
  providerKey: string,
  providerTargetRef: string,
  receipt: {
    providerKey: string;
    providerDeploymentId: string;
    targetRef: string;
    manifestId: string;
    manifestDigest: string;
  },
) {
  if (
    receipt.providerKey !== providerKey ||
    receipt.targetRef !== providerTargetRef ||
    receipt.providerDeploymentId !== input.deploymentRunId ||
    receipt.manifestId !== input.manifestId ||
    receipt.manifestDigest !== input.digest
  ) {
    throw new ReleaseStagingExecutionError({
      code: "DEPLOYMENT_PROVIDER_RECEIPT_MISMATCH",
      message: "Deployment Provider 回执与 exact Manifest 输入不匹配",
      logs: [],
    });
  }
}
