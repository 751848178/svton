import { ConfigService } from "@nestjs/config";
import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { LocalReleaseBuildExecutorService } from "./local-release-build-executor.service";
import { LocalReleaseEvidenceArtifactService } from "./local-release-evidence-artifact.service";
import { ReleaseBuildArtifactService } from "./release-build-artifact.service";
import { releaseBuildFailureDetail } from "./release-build-failure.utils";
import { ReleaseBuildPackageEvidenceService } from "./release-build-package-evidence.service";
import { ReleaseBuildRuntimeProfileService } from "./release-build-runtime-profile.service";
import type { ReleaseBuildExecutionResult } from "./release-build.types";
import type { ReleaseBuildWorkerRequest } from "./release-build-worker-envelope.policy";
import { createWritableBrokerWorkspace } from "./release-build-broker-workspace";

export type ReleaseBuildBrokerInput = {
  version: 1;
  request: Omit<ReleaseBuildWorkerRequest, "signature">;
  jobRoot: string;
  workRoot: string;
  buildRoot: string;
  artifactRoot: string;
  supplyProofFile: string;
  commandPath: string;
  commandTimeoutMs: number;
  cancelGraceMs: number;
  prepared: {
    security: unknown;
    sourceSnapshot: { sourceCommitSha: string; treeHash: string; snapshotDigest: string };
  };
};

export type ReleaseBuildBrokerResult = {
  version: 1;
  status: "succeeded" | "failed" | "canceled";
  result?: ReleaseBuildExecutionResult;
  failure?: ReturnType<typeof releaseBuildFailureDetail>;
};

export async function runReleaseBuildBroker(
  input: ReleaseBuildBrokerInput,
): Promise<ReleaseBuildBrokerResult> {
  try {
    await assertBrokerInput(input);
    const writableBuildRoot = await createWritableBrokerWorkspace(
      input.buildRoot,
      input.workRoot,
    );
    const config = brokerConfig(input);
    const runtime = new ReleaseBuildRuntimeProfileService(config);
    const evidence = new LocalReleaseEvidenceArtifactService(config);
    const executor = new LocalReleaseBuildExecutorService(
      runtime,
      new ReleaseBuildArtifactService(config),
      new ReleaseBuildPackageEvidenceService(evidence),
      { prepare: async () => ({ ...input.prepared, buildRoot: writableBuildRoot }) } as never,
    );
    const request = input.request;
    const result = await executor.execute({
      buildRunId: request.identity.buildRunId,
      projectId: request.identity.projectId,
      releaseOrderId: request.identity.releaseOrderId,
      sourceCommitSha: request.identity.sourceCommitSha,
      checkoutRoot: writableBuildRoot,
      components: request.components,
    });
    return { version: 1, status: "succeeded", result };
  } catch (error) {
    const failure = releaseBuildFailureDetail(error, new AbortController().signal);
    return {
      version: 1,
      status: failure.status === "canceled" ? "canceled" : "failed",
      failure,
    };
  }
}

async function assertBrokerInput(input: ReleaseBuildBrokerInput) {
  if (input.version !== 1 || input.request.version !== 1) throw invalid();
  const job = await realpath(input.jobRoot);
  for (const value of [input.workRoot, input.buildRoot, input.artifactRoot, input.supplyProofFile]) {
    if (!isAbsolute(value)) throw invalid();
    const target = await realpath(value);
    const path = relative(job, target);
    if (path.startsWith("..") || isAbsolute(path)) throw invalid();
  }
}

function brokerConfig(input: ReleaseBuildBrokerInput) {
  return new ConfigService({
    NODE_ENV: "production",
    RELEASE_BUILD_EXECUTION_ENABLED: true,
    RELEASE_BUILD_EXECUTOR_PROFILE: input.request.identity.profileId,
    RELEASE_BUILD_UNTRUSTED_WORKER_PROVIDER: "external-oci-launcher-v1",
    RELEASE_BUILD_WORKER_PROCESS: true,
    RELEASE_BUILD_LAUNCHER_CHILD: true,
    RELEASE_BUILD_WORK_ROOT: input.workRoot,
    RELEASE_BUILD_ARTIFACT_ROOT: input.artifactRoot,
    RELEASE_BUILD_SUPPLY_PROOF_FILE: input.supplyProofFile,
    RELEASE_BUILD_COMMAND_PATH: input.commandPath,
    RELEASE_BUILD_COMMAND_TIMEOUT_MS: input.commandTimeoutMs,
    RELEASE_BUILD_CANCEL_GRACE_MS: input.cancelGraceMs,
  });
}

function invalid() { return new Error("Release Build broker input is invalid"); }
