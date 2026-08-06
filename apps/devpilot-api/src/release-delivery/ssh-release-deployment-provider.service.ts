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
  sshProviderFailure,
} from "./ssh-release-deployment-provider.utils";

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
    assertSshDeploymentInput(input, {
      host: this.host,
      username: this.username,
      password: this.password,
      privateKey: this.privateKey,
      root: this.root,
      targetRef: this.targetRef,
    });
    const base = `${this.root}/${input.projectId}/${input.environmentId}`;
    const archive = `${base}/.incoming/${input.deploymentRunId}.zip`;
    const release = `${base}/releases/${input.deploymentRunId}`;
    const active = `${base}/active.json`;
    const transport = this.transports.create({
      host: this.host,
      port: this.port,
      username: this.username,
      password: this.password,
      privateKey: this.privateKey,
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
      const result = await requireSuccessfulSsh(
        transport.execScript(
          buildSshActivationScript(input, { archive, release, active }),
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
        targetRef: this.targetRef,
        deploymentUri: `ssh-release://${this.host}:${this.port}/${input.projectId}/${input.environmentId}/releases/${input.deploymentRunId}`,
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
          artifactSizeBytes: input.artifact.sizeBytes,
          checkoutInvoked: false,
          pullInvoked: false,
          buildInvoked: false,
          gitInvoked: false,
        },
      };
    } catch (error) {
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
