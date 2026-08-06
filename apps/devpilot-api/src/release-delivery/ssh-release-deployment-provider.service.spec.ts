import { ConfigService } from "@nestjs/config";
import { readFile, stat } from "node:fs/promises";
import type { SshTransport } from "../common/ssh/ssh-transport";
import type { SshTransportFactory } from "../common/ssh/ssh-transport.factory";
import { SshReleaseDeploymentProviderService } from "./ssh-release-deployment-provider.service";
import { ReleaseRuntimeEnvironmentFileService } from "./release-runtime-environment-file.service";

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
    const provider = new SshReleaseDeploymentProviderService(
      config(),
      factory,
      new ReleaseRuntimeEnvironmentFileService(),
    );
    const receipt = await provider.deployExactManifest(
      input(provider.targetRef),
    );
    expect(transport.uploadFile).toHaveBeenCalledWith(
      "/artifacts/bundle.zip",
      "/srv/devpilot/project-1/staging-1/.incoming/deployment-1.zip",
      { timeoutMs: 5_000 },
    );
    expect(transport.uploadFile).toHaveBeenCalledWith(
      expect.any(String),
      "/srv/devpilot/project-1/staging-1/.incoming/deployment-1.env",
      { timeoutMs: 5_000, mode: 0o600 },
    );
    expect(scripts.join("\n")).toMatch(
      /sha256sum.*runtime_mode.*unzip.*release_created=1.*activated=1/s,
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
        runtimeEnvironmentFileMode: "0600",
        checkoutInvoked: false,
        pullInvoked: false,
        buildInvoked: false,
        gitInvoked: false,
      },
    });
  });

  it("rejects target or Digest drift before opening a connection", async () => {
    const provider = new SshReleaseDeploymentProviderService(
      config(),
      factory,
      new ReleaseRuntimeEnvironmentFileService(),
    );
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

  it("uses the frozen environment binding and keeps runtime values out of scripts and receipts", async () => {
    let runtimePath = "";
    let runtimeBody = "";
    let runtimeMode = 0;
    (transport.uploadFile as jest.Mock).mockImplementation(
      async (localPath: string, remotePath: string) => {
        if (!remotePath.endsWith(".env")) return;
        runtimePath = localPath;
        runtimeBody = await readFile(localPath, "utf8");
        runtimeMode = (await stat(localPath)).mode & 0o777;
      },
    );
    const provider = new SshReleaseDeploymentProviderService(
      config(),
      factory,
      new ReleaseRuntimeEnvironmentFileService(),
    );
    const targetRef = "ssh://bound@bound.example:2200/srv/bound";
    const receipt = await provider.deployExactManifest({
      ...input(targetRef),
      runtimeEnvironment: { API_TOKEN: "secret-sentinel-f432" },
      targetConnection: {
        host: "bound.example",
        port: 2200,
        username: "bound",
        authType: "password",
        credential: "target-credential-sentinel-f432",
        root: "/srv/bound",
      },
    });

    expect(factory.create).toHaveBeenCalledWith(
      expect.objectContaining({ host: "bound.example", port: 2200 }),
    );
    expect(runtimeBody).toBe("API_TOKEN=secret-sentinel-f432\n");
    expect(runtimeMode).toBe(0o600);
    await expect(readFile(runtimePath, "utf8")).rejects.toThrow();
    const publicEvidence = JSON.stringify({ receipt, scripts });
    expect(publicEvidence).not.toContain("secret-sentinel-f432");
    expect(publicEvidence).not.toContain("target-credential-sentinel-f432");
    expect(receipt.targetRef).toBe(targetRef);
  });

  it("best-effort removes uploaded runtime input when activation cannot start", async () => {
    (transport.uploadFile as jest.Mock).mockRejectedValueOnce(
      new Error("upload failed"),
    );
    const provider = new SshReleaseDeploymentProviderService(
      config(),
      factory,
      new ReleaseRuntimeEnvironmentFileService(),
    );

    await expect(
      provider.deployExactManifest(input(provider.targetRef)),
    ).rejects.toThrow("执行失败");
    expect(scripts.at(-1)).toMatch(
      /rm -f .*deployment-1\.zip.*deployment-1\.env/,
    );
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
