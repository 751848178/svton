import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SshTransportFactory } from "../common/ssh/ssh-transport.factory";
import { sanitizeBuildLogs } from "./release-build-log.utils";
import {
  ExactManifestDeploymentInput,
  ReleaseDeploymentProviderError,
  ReleaseDeploymentProviderPort,
} from "./release-deployment-provider.types";
import {
  assertSshDeploymentInput,
  buildSshActivationScript,
  quoteSsh,
  requireSuccessfulSsh,
  resolveSshDeploymentTarget,
  sshProviderFailure,
} from "./ssh-release-deployment-provider.utils";
import { ReleaseRuntimeEnvironmentFileService } from "./release-runtime-environment-file.service";

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
    return this.runtimeFiles.use(input.runtimeEnvironment || {}, (path) =>
      this.deploy(input, path),
    );
  }

  private async deploy(
    input: ExactManifestDeploymentInput,
    runtimeFile: string,
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
    const runtime = `${base}/.incoming/${input.deploymentRunId}.env`;
    const release = `${base}/releases/${input.deploymentRunId}`;
    const active = `${base}/active.json`;
    const transport = this.transports.create({
      host: target.host,
      port: target.port,
      username: target.username,
      password: target.password,
      privateKey: target.privateKey,
    });
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
      await transport.uploadFile(runtimeFile, runtime, {
        timeoutMs: this.timeoutMs,
        mode: 0o600,
      });
      const result = await requireSuccessfulSsh(
        transport.execScript(
          buildSshActivationScript(input, {
            archive,
            runtime,
            release,
            active,
          }),
          {
            timeoutMs: this.timeoutMs,
          },
        ),
        "DEPLOYMENT_TARGET_ACTIVATION_FAILED",
      );
      const activatedAt = new Date().toISOString();
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
        ]),
        evidence: {
          providerActivated: true,
          targetType: "ssh-environment",
          remoteDigestVerified: true,
          runtimeEnvironmentFileMode: "0600",
          artifactSizeBytes: input.artifact.sizeBytes,
          runtimeEnvironmentKeys: Object.keys(
            input.runtimeEnvironment || {},
          ).sort(),
          checkoutInvoked: false,
          pullInvoked: false,
          buildInvoked: false,
          gitInvoked: false,
        },
      };
    } catch (error) {
      await transport
        .execScript(`rm -f ${quoteSsh(archive)} ${quoteSsh(runtime)}\n`, {
          timeoutMs: this.timeoutMs,
        })
        .catch(() => undefined);
      if (error instanceof ReleaseDeploymentProviderError) throw error;
      throw sshProviderFailure(
        "DEPLOYMENT_PROVIDER_FAILED",
        "SSH Deployment Provider 执行失败",
        [message(error)],
      );
    } finally {
      await transport.dispose?.();
    }
  }
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
