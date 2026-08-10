import { ConfigService } from "@nestjs/config";
import { ConfiguredReleaseDeploymentProviderService } from "./configured-release-deployment-provider.service";

describe("ConfiguredReleaseDeploymentProviderService", () => {
  const local = {
    key: "local-filesystem-v1",
    targetRef: "filesystem-release-target",
    deployExactManifest: jest.fn(),
  };
  const ssh = {
    key: "ssh-v1",
    targetRef: "ssh://deploy@target:22/releases",
    deployExactManifest: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it("requires the enable switch and explicit provider profile", async () => {
    const disabled = service(false, "ssh-v1");
    expect(() => disabled.deployExactManifest({} as never)).toThrow(
      "Provider 未启用",
    );
    const missing = service(true, "disabled");
    expect(() => missing.deployExactManifest({} as never)).toThrow(
      "Provider 未启用",
    );
    expect(ssh.deployExactManifest).not.toHaveBeenCalled();
  });

  it("publishes the selected provider identity before execution", async () => {
    ssh.deployExactManifest.mockResolvedValue({ providerKey: "ssh-v1" });
    const selected = service(true, "ssh-v1");
    expect(selected.key).toBe("ssh-v1");
    expect(selected.targetRef).toBe("ssh://deploy@target:22/releases");
    await selected.deployExactManifest({ deploymentRunId: "run-1" } as never);
    expect(ssh.deployExactManifest).toHaveBeenCalledTimes(1);
    expect(local.deployExactManifest).not.toHaveBeenCalled();
  });

  function service(enabled: boolean, profile: string) {
    const config = {
      get: jest.fn((key: string) =>
        key === "RELEASE_STAGING_DEPLOYMENT_ENABLED" ? enabled : profile,
      ),
    } as unknown as ConfigService;
    return new ConfiguredReleaseDeploymentProviderService(
      config,
      local as never,
      ssh as never,
    );
  }
});
