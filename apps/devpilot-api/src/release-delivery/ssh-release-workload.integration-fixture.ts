import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SshTransportFactory } from "../common/ssh/ssh-transport.factory";
import { ReleaseBuildArtifactService } from "./release-build-artifact.service";
import { SshReleaseDeploymentProviderService } from "./ssh-release-deployment-provider.service";
import { ReleaseRuntimeEnvironmentFileService } from "./release-runtime-environment-file.service";
import type { ReleaseStagingWorkloadSnapshot } from "./release-staging-workload.types";
import { sshIntegrationRuntimeConfig } from "./ssh-release-deployment-provider.integration-fixture";
import {
  deploySshWorkloadOrExplain,
  sshWorkloadComponents,
  sshWorkloadFiles,
  sshWorkloadSnapshot,
} from "./ssh-release-workload.integration-utils";
import {
  cleanupSshReleaseWorkloadTarget,
  probeSshReleaseWorkloadTarget,
} from "./ssh-release-workload-target.fixture";

export class SshReleaseWorkloadIntegrationFixture {
  private readonly suffix = randomUUID().replaceAll("-", "");
  private readonly remoteRoot = `/config/f433-${this.suffix}`;
  private readonly portBase =
    20_000 + (Number.parseInt(this.suffix.slice(0, 4), 16) % 4_000);
  private scope = "";
  private provider!: SshReleaseDeploymentProviderService;
  private artifacts!: ReleaseBuildArtifactService;
  private artifact!: { uri: string; digest: string };
  private processWorkload!: ReleaseStagingWorkloadSnapshot;
  private commandWorkload!: ReleaseStagingWorkloadSnapshot;

  async start() {
    this.scope = await mkdtemp(join(tmpdir(), "f433-ssh-workload-"));
    const checkout = join(this.scope, "checkout");
    for (const key of ["frontend", "backend", "static", "worker"]) {
      await mkdir(join(checkout, "dist", key), { recursive: true });
      await writeFile(
        join(checkout, "dist", key, "index.html"),
        `${key}-exact-manifest-f433`,
      );
      for (const file of sshWorkloadFiles(
        key,
        this.portBase +
          ["frontend", "backend", "static", "worker"].indexOf(key),
      )) {
        await writeFile(join(checkout, "dist", key, file.name), file.body);
      }
    }
    const config = sshIntegrationRuntimeConfig(this.scope, this.remoteRoot);
    this.artifacts = new ReleaseBuildArtifactService(config);
    const published = await this.artifacts.package({
      checkoutRoot: checkout,
      projectId: "project-f433",
      releaseOrderId: "order-f433",
      buildRunId: "build-f433",
      components: sshWorkloadComponents(),
    });
    this.artifact = published;
    const items = published.items.map((item) => ({
      key: item.componentKey,
      digest: item.digest,
    }));
    this.processWorkload = sshWorkloadSnapshot(
      items,
      published.digest,
      this.portBase,
      "managed-process-v1",
    );
    this.commandWorkload = sshWorkloadSnapshot(
      items,
      published.digest,
      this.portBase,
      "managed-command-v1",
    );
    this.provider = new SshReleaseDeploymentProviderService(
      config,
      new SshTransportFactory(),
      new ReleaseRuntimeEnvironmentFileService(),
    );
  }

  async deployAcrossModes() {
    const verified = await this.artifacts.resolveAndVerify({
      projectId: "project-f433",
      releaseOrderId: "order-f433",
      buildRunId: "build-f433",
      uri: this.artifact.uri,
      digest: this.artifact.digest,
    });
    const first = await deploySshWorkloadOrExplain(
      this.provider,
      this.input("deployment-f433-1", verified, this.processWorkload),
    );
    const second = await deploySshWorkloadOrExplain(
      this.provider,
      this.input("deployment-f433-2", verified, this.commandWorkload),
    );
    const third = await deploySshWorkloadOrExplain(
      this.provider,
      this.input("deployment-f433-3", verified, this.processWorkload),
    );
    return { first, second, third };
  }

  async deployWithFailingHealth() {
    const verified = await this.artifacts.resolveAndVerify({
      projectId: "project-f433",
      releaseOrderId: "order-f433",
      buildRunId: "build-f433",
      uri: this.artifact.uri,
      digest: this.artifact.digest,
    });
    const workload = {
      ...this.commandWorkload,
      services: this.commandWorkload.services.map((service) =>
        service.serviceId === "worker"
          ? {
              ...service,
              health: {
                url: "http://127.0.0.1:9/health",
                origin: "http://127.0.0.1:9",
                maxAttempts: 1,
                intervalMs: 0,
                timeoutMs: 100,
              },
            }
          : service,
      ),
    };
    return this.provider.deployExactManifest({
      ...this.input("deployment-f433-failed", verified, this.commandWorkload),
      workload,
    });
  }

  async probe() {
    return probeSshReleaseWorkloadTarget(this.remoteRoot, this.portBase);
  }

  async stop() {
    try {
      await cleanupSshReleaseWorkloadTarget(this.remoteRoot);
    } finally {
      if (this.scope) await rm(this.scope, { recursive: true, force: true });
    }
  }

  private input(
    deploymentRunId: string,
    artifact: { path: string; sizeBytes: number },
    workload: ReleaseStagingWorkloadSnapshot,
  ) {
    return {
      deploymentRunId,
      stage: "staging" as const,
      projectId: "project-f433",
      releaseOrderId: "order-f433",
      environmentId: "staging-f433",
      targetRef: this.provider.targetRef,
      manifest: {
        id: "manifest-f433",
        buildRunId: "build-f433",
        uri: this.artifact.uri,
        digest: this.artifact.digest,
      },
      artifact,
      runtimeEnvironment: { F433_RUNTIME: "runtime-sentinel-f433" },
      workload,
    };
  }
}
