import { ConfigService } from "@nestjs/config";
import type { SshTransport } from "../common/ssh/ssh-transport";
import type { SshTransportFactory } from "../common/ssh/ssh-transport.factory";
import { SshReleaseDeploymentProviderService } from "./ssh-release-deployment-provider.service";

describe("SshReleaseDeploymentProviderService", () => {
  const scripts: string[] = [];
  const transport: SshTransport = {
    execScript: jest.fn(async (script) => {
      scripts.push(script);
      return {
        exitCode: 0,
        stdout: script.includes("sha256sum")
          ? `remoteDigest=sha256:${"a".repeat(64)}\nentries=3\n`
          : "",
        stderr: "",
        timedOut: false,
        cancelled: false,
      };
    }),
    execCommand: jest.fn(),
    uploadFile: jest.fn(async () => undefined),
    dispose: jest.fn(),
  };
  const factory = {
    create: jest.fn(() => transport),
  } as unknown as SshTransportFactory;

  beforeEach(() => {
    jest.clearAllMocks();
    scripts.length = 0;
  });

  it("uploads exact bytes, verifies the remote Digest, and atomically activates the target", async () => {
    const provider = new SshReleaseDeploymentProviderService(config(), factory);
    const receipt = await provider.deployExactManifest(
      input(provider.targetRef),
    );
    expect(transport.uploadFile).toHaveBeenCalledWith(
      "/artifacts/bundle.zip",
      "/srv/devpilot/project-1/staging-1/.incoming/deployment-1.zip",
      { timeoutMs: 5_000 },
    );
    expect(scripts.join("\n")).toMatch(
      /sha256sum.*unzip.*release_created=1.*activated=1/s,
    );
    expect(scripts.join("\n")).not.toMatch(
      /(^|[\n;])\s*(git|checkout|pull|npm|pnpm|yarn|build)\b/m,
    );
    expect(receipt).toMatchObject({
      providerKey: "ssh-v1",
      providerDeploymentId: "deployment-1",
      targetRef: provider.targetRef,
      manifestId: "manifest-1",
      evidence: {
        providerActivated: true,
        remoteDigestVerified: true,
        checkoutInvoked: false,
        pullInvoked: false,
        buildInvoked: false,
        gitInvoked: false,
      },
    });
  });

  it("rejects target or Digest drift before opening a connection", async () => {
    const provider = new SshReleaseDeploymentProviderService(config(), factory);
    await expect(
      provider.deployExactManifest(input("ssh://foreign")),
    ).rejects.toThrow("目标引用无效");
    await expect(
      provider.deployExactManifest({
        ...input(provider.targetRef),
        manifest: {
          ...input(provider.targetRef).manifest,
          digest: "sha256:bad",
        },
      }),
    ).rejects.toThrow("Digest 格式无效");
    expect(factory.create).not.toHaveBeenCalled();
  });
});

function config() {
  const values: Record<string, unknown> = {
    RELEASE_DEPLOYMENT_SSH_HOST: "target.test",
    RELEASE_DEPLOYMENT_SSH_PORT: 2222,
    RELEASE_DEPLOYMENT_SSH_USERNAME: "deploy",
    RELEASE_DEPLOYMENT_SSH_PASSWORD: "test-only",
    RELEASE_DEPLOYMENT_SSH_ROOT: "/srv/devpilot",
    RELEASE_STAGING_DEPLOYMENT_TIMEOUT_MS: 5_000,
  };
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

function input(targetRef: string) {
  return {
    deploymentRunId: "deployment-1",
    stage: "staging" as const,
    projectId: "project-1",
    releaseOrderId: "order-1",
    environmentId: "staging-1",
    targetRef,
    manifest: {
      id: "manifest-1",
      buildRunId: "build-1",
      uri: "release-artifact://build-1/bundle.zip",
      digest: `sha256:${"a".repeat(64)}`,
    },
    artifact: { path: "/artifacts/bundle.zip", sizeBytes: 123 },
  };
}
