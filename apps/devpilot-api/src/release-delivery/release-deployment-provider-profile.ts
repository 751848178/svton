import type { ConfigService } from "@nestjs/config";

export function resolveConfiguredReleaseDeploymentProviderKey(
  config: ConfigService,
) {
  const enabled = config.get<boolean>("RELEASE_STAGING_DEPLOYMENT_ENABLED") === true;
  const profile = config.get<string>("RELEASE_DEPLOYMENT_PROVIDER_PROFILE");
  return enabled && (profile === "local-filesystem-v1" || profile === "ssh-v1")
    ? profile
    : "disabled";
}
