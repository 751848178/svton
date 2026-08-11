import { ConfigService } from "@nestjs/config";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { LocalReleaseEvidenceArtifactService } from "./local-release-evidence-artifact.service";
import { ReleaseBuildPreScriptSecurityService } from "./release-build-pre-script-security.service";
import { ReleaseBuildScannerEvidenceService } from "./release-build-scanner-evidence.service";
import { ReleaseBuildWorkerExtractedSnapshotService } from "./release-build-worker-extracted-snapshot.service";
import type { RegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import type { ReleaseBuildWorkerRequest } from "./release-build-worker-envelope.policy";

export async function scanSupervisorSource(input: {
  request: ReleaseBuildWorkerRequest;
  profile: RegisteredReleaseBuildProfile;
  sourceRoot: string;
  trustedRoot: string;
  commandPath: string;
  commandTimeoutMs: number;
  cancelGraceMs: number;
  signal?: AbortSignal;
}) {
  const artifactRoot = join(input.trustedRoot, "artifacts");
  await mkdir(artifactRoot, { recursive: true, mode: 0o700 });
  const config = new ConfigService({ RELEASE_BUILD_ARTIFACT_ROOT: artifactRoot });
  const snapshots = new ReleaseBuildWorkerExtractedSnapshotService(
    input.request.identity,
    input.request.sourceManifest,
  );
  const service = new ReleaseBuildPreScriptSecurityService(
    snapshots as never,
    new ReleaseBuildScannerEvidenceService(
      new LocalReleaseEvidenceArtifactService(config),
    ),
  );
  const runtimeRoot = join(input.trustedRoot, "scan-runtime");
  await mkdir(runtimeRoot, { mode: 0o700 });
  return {
    prepared: await service.prepare({
      projectId: input.request.identity.projectId,
      releaseOrderId: input.request.identity.releaseOrderId,
      buildRunId: input.request.identity.buildRunId,
      sourceCommitSha: input.request.identity.sourceCommitSha,
      sourceRoot: input.sourceRoot,
      runtimeRoot,
      workRoot: input.trustedRoot,
      profile: input.profile,
      env: {
        PATH: input.commandPath,
        HOME: input.trustedRoot,
        TMPDIR: input.trustedRoot,
        LANG: "C.UTF-8",
      },
      timeoutMs: input.commandTimeoutMs,
      cancelGraceMs: input.cancelGraceMs,
      signal: input.signal,
    }),
    artifactRoot,
  };
}
