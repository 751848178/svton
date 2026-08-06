import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LocalFilesystemDeploymentProviderService } from "./local-filesystem-deployment-provider.service";
import {
  ExactManifestDeploymentInput,
  ReleaseDeploymentProviderError,
  ReleaseDeploymentProviderPort,
} from "./release-deployment-provider.types";
import { SshReleaseDeploymentProviderService } from "./ssh-release-deployment-provider.service";

@Injectable()
export class ConfiguredReleaseDeploymentProviderService extends ReleaseDeploymentProviderPort {
  private readonly enabled: boolean;
  private readonly provider?: ReleaseDeploymentProviderPort;

  constructor(
    config: ConfigService,
    local: LocalFilesystemDeploymentProviderService,
    ssh: SshReleaseDeploymentProviderService,
  ) {
    super();
    this.enabled =
      config.get<boolean>("RELEASE_STAGING_DEPLOYMENT_ENABLED") === true;
    const profile = config.get<string>("RELEASE_DEPLOYMENT_PROVIDER_PROFILE");
    this.provider =
      profile === local.key ? local : profile === ssh.key ? ssh : undefined;
  }

  get key() {
    return this.provider?.key || "disabled";
  }

  get targetRef() {
    return this.provider?.targetRef || "disabled";
  }

  deployExactManifest(input: ExactManifestDeploymentInput) {
    if (!this.enabled || !this.provider) {
      throw new ReleaseDeploymentProviderError({
        code: "DEPLOYMENT_PROVIDER_DISABLED",
        message: "exact-Manifest Deployment Provider 未启用",
        logs: [],
      });
    }
    return this.provider.deployExactManifest(input);
  }
}
