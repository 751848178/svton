import type { ExactManifestDeploymentInput } from "./release-deployment-provider.types";

export function sshReleaseDeploymentEvidence(
  input: ExactManifestDeploymentInput,
  workloadEvidence: Record<string, unknown>,
) {
  return {
    providerActivated: true,
    targetType: "ssh-environment",
    remoteDigestVerified: true,
    runtimeEnvironmentFileMode: "0600",
    artifactSizeBytes: input.artifact.sizeBytes,
    globalEnvironmentKeys: Object.keys(input.globalEnvironment || {}).sort(),
    componentEnvironmentKeys: Object.fromEntries(
      Object.entries(input.componentEnvironments || {}).map(([key, value]) => [
        key,
        Object.keys(value).sort(),
      ]),
    ),
    ...workloadEvidence,
    checkoutInvoked: false,
    pullInvoked: false,
    buildInvoked: false,
    gitInvoked: false,
  };
}
