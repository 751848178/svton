import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SshTransportFactory } from "../common/ssh/ssh-transport.factory";
import { sanitizeBuildLogs } from "./release-build-log.utils";
import {
  ExactManifestDeploymentInput,
  ReleaseDeploymentProviderPort,
  releaseWorkloadCleanupWasAttempted,
} from "./release-deployment-provider.types";
import {
  assertSshDeploymentInput,
  mergeSshProviderFailure,
  quoteSsh,
  requireSuccessfulSsh,
  resolveSshDeploymentTarget,
  sshProviderFailure,
} from "./ssh-release-deployment-provider.utils";
import {
  buildSshMaterializationScript,
  buildSshPublishScript,
} from "./ssh-release-deployment-scripts";
import { ReleaseRuntimeEnvironmentFileService } from "./release-runtime-environment-file.service";
import { sshReleaseDeploymentEvidence } from "./ssh-release-deployment-evidence";
import {
  cleanupReleaseWorkloads,
  runReleaseWorkloads,
} from "./release-workload-runtime";

@Injectable()
export class SshReleaseDeploymentProviderService extends ReleaseDeploymentProviderPort {
  readonly key = "ssh-v1";
  readonly targetRef: string;
  private readonly host: string;
  private readonly port: number;
  private readonly username: string;
  private readonly password?: string;
  private readonly privateKey?: string;
  private readonly root: string;
  private readonly timeoutMs: number;

  constructor(
    config: ConfigService,
    private readonly transports: SshTransportFactory,
    private readonly runtimeFiles: ReleaseRuntimeEnvironmentFileService,
  ) {
    super();
    this.host = config.get<string>("RELEASE_DEPLOYMENT_SSH_HOST") || "";
    this.port = Number(config.get("RELEASE_DEPLOYMENT_SSH_PORT")) || 22;
    this.username = config.get<string>("RELEASE_DEPLOYMENT_SSH_USERNAME") || "";
    this.password =
      config.get<string>("RELEASE_DEPLOYMENT_SSH_PASSWORD") || undefined;
    this.privateKey =
      config.get<string>("RELEASE_DEPLOYMENT_SSH_PRIVATE_KEY") || undefined;
    this.root =
      config.get<string>("RELEASE_DEPLOYMENT_SSH_ROOT") ||
      "/tmp/devpilot-releases";
    this.timeoutMs =
      Number(config.get("RELEASE_STAGING_DEPLOYMENT_TIMEOUT_MS")) || 120_000;
    this.targetRef = `ssh://${this.username}@${this.host}:${this.port}${this.root}`;
  }

  async deployExactManifest(input: ExactManifestDeploymentInput) {
    return this.runtimeFiles.useComponents(input, (paths) =>
      this.deploy(input, paths),
    );
  }

  private async deploy(
    input: ExactManifestDeploymentInput,
    runtimeFiles: Record<string, string>,
  ) {
    const target = resolveSshDeploymentTarget(input, {
      host: this.host,
      port: this.port,
      username: this.username,
      password: this.password,
      privateKey: this.privateKey,
      root: this.root,
      targetRef: this.targetRef,
    });
    assertSshDeploymentInput(input, target);
    const base = `${target.root}/${input.projectId}/${input.environmentId}`;
    const archive = `${base}/.incoming/${input.deploymentRunId}.zip`;
    const runtimes = Object.fromEntries(
      Object.keys(runtimeFiles).map((componentKey) => [
        componentKey,
        `${base}/.incoming/${input.deploymentRunId}.${componentKey}.env`,
      ]),
    );
    const release = `${base}/releases/${input.deploymentRunId}`;
    const active = `${base}/active.json`;
    const pending = `${active}.${input.deploymentRunId}.tmp`;
    const transport = this.transports.create({
      host: target.host,
      port: target.port,
      username: target.username,
      password: target.password,
      privateKey: target.privateKey,
    });
    const execute = (script: string, timeoutMs: number) =>
      transport.execScript(script, { timeoutMs });
    const runtimeInput = input.workload
      ? {
          snapshot: input.workload,
          releaseRoot: release,
          runtimePaths: Object.fromEntries(
            Object.keys(runtimeFiles).map((componentKey) => [
              componentKey,
              `${release}/.devpilot/env/${componentKey}.env`,
            ]),
          ),
          globalEnvironment: input.globalEnvironment || {},
          componentEnvironments: input.componentEnvironments || {},
          execute,
        }
      : undefined;
    try {
      await requireSuccessfulSsh(
        transport.execScript(
          `set -eu\nmkdir -p ${quoteSsh(`${base}/.incoming`)} ${quoteSsh(`${base}/releases`)}\n`,
          { timeoutMs: this.timeoutMs },
        ),
        "DEPLOYMENT_TARGET_PREPARE_FAILED",
      );
      if (!transport.uploadFile) {
        throw sshProviderFailure(
          "DEPLOYMENT_TARGET_UPLOAD_UNSUPPORTED",
          "SSH transport 不支持 SFTP 上传",
          [],
        );
      }
      await transport.uploadFile(input.artifact.path, archive, {
        timeoutMs: this.timeoutMs,
      });
      for (const [componentKey, localPath] of Object.entries(runtimeFiles)) {
        await transport.uploadFile(localPath, runtimes[componentKey], {
          timeoutMs: this.timeoutMs,
          mode: 0o600,
        });
      }
      const result = await requireSuccessfulSsh(
        transport.execScript(
          buildSshMaterializationScript(input, {
            archive,
            runtimes,
            release,
          }),
          {
            timeoutMs: this.timeoutMs,
          },
        ),
        "DEPLOYMENT_TARGET_ACTIVATION_FAILED",
      );
      const workload = runtimeInput
        ? await runReleaseWorkloads(runtimeInput)
        : { logs: [], evidence: {} };
      const activatedAt = new Date().toISOString();
      await requireSuccessfulSsh(
        transport.execScript(
          buildSshPublishScript(input, { active }, activatedAt),
          {
            timeoutMs: this.timeoutMs,
          },
        ),
        "DEPLOYMENT_TARGET_PUBLISH_FAILED",
      );
      return {
        providerKey: this.key,
        providerDeploymentId: input.deploymentRunId,
        targetRef: input.targetRef,
        deploymentUri: `ssh-release://${target.host}:${target.port}/${input.projectId}/${input.environmentId}/releases/${input.deploymentRunId}`,
        manifestId: input.manifest.id,
        manifestDigest: input.manifest.digest,
        activatedAt,
        logs: sanitizeBuildLogs([
          `provider ${this.key} delivered exact Manifest`,
          ...result.stdout.split(/\r?\n/).filter(Boolean),
          ...workload.logs,
        ]),
        evidence: sshReleaseDeploymentEvidence(input, workload.evidence),
      };
    } catch (error) {
      const cleanupLogs =
        runtimeInput && !releaseWorkloadCleanupWasAttempted(error)
          ? await cleanupReleaseWorkloads(runtimeInput)
          : [];
      await transport
        .execScript(
          `rm -f ${quoteSsh(archive)} ${Object.values(runtimes).map(quoteSsh).join(" ")} ${quoteSsh(pending)}\nrm -rf ${quoteSsh(release)}\n`,
          { timeoutMs: this.timeoutMs },
        )
        .catch(() => undefined);
      throw mergeSshProviderFailure(error, cleanupLogs);
    } finally {
      await transport.dispose?.();
    }
  }
}
