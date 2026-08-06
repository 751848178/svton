import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SshTransportFactory } from "../common/ssh/ssh-transport.factory";
import { ReleaseBuildArtifactService } from "./release-build-artifact.service";
import { ReleaseDeploymentProviderError } from "./release-deployment-provider.types";
import { SshReleaseDeploymentProviderService } from "./ssh-release-deployment-provider.service";

const describeIntegration =
  process.env.RUN_F431_SSH_PROVIDER_INTEGRATION === "1"
    ? describe
    : describe.skip;

jest.setTimeout(45_000);

describeIntegration("F431 SSH exact-Manifest provider", () => {
  const suffix = randomUUID().replaceAll("-", "");
  const remoteRoot = `/config/f431-${suffix}`;
  let scope: string;
  let provider: SshReleaseDeploymentProviderService;
  let artifacts: ReleaseBuildArtifactService;
  let artifact: { uri: string; digest: string };

  beforeAll(async () => {
    scope = await mkdtemp(join(tmpdir(), "f431-ssh-provider-"));
    const checkout = join(scope, "checkout");
    await mkdir(join(checkout, "dist"), { recursive: true });
    await writeFile(join(checkout, "dist", "app.txt"), "remote exact manifest");
    const config = runtimeConfig(scope, remoteRoot);
    artifacts = new ReleaseBuildArtifactService(config);
    artifact = await artifacts.package({
      checkoutRoot: checkout,
      projectId: "project-1",
      releaseOrderId: "order-1",
      buildRunId: "build-1",
      components: [component()],
    });
    provider = new SshReleaseDeploymentProviderService(
      config,
      new SshTransportFactory(),
    );
  });

  afterAll(async () => {
    if (provider) await cleanupRemote(provider, remoteRoot);
    if (scope) await rm(scope, { recursive: true, force: true });
  });

  it("uploads twice, rehashes remotely, and activates only exact run releases", async () => {
    const verified = await artifacts.resolveAndVerify({
      projectId: "project-1",
      releaseOrderId: "order-1",
      buildRunId: "build-1",
      uri: artifact.uri,
      digest: artifact.digest,
    });
    const first = await deployOrExplain(
      provider,
      input("deployment-1", provider.targetRef, artifact, verified),
    );
    const second = await deployOrExplain(
      provider,
      input("deployment-2", provider.targetRef, artifact, verified),
    );
    expect(first.providerDeploymentId).not.toBe(second.providerDeploymentId);
    for (const receipt of [first, second]) {
      expect(receipt).toMatchObject({
        providerKey: "ssh-v1",
        manifestDigest: artifact.digest,
        evidence: {
          providerActivated: true,
          remoteDigestVerified: true,
          checkoutInvoked: false,
          pullInvoked: false,
          buildInvoked: false,
          gitInvoked: false,
        },
      });
    }
    const probe = await remoteProbe(provider, remoteRoot);
    expect(probe.exitCode).toBe(0);
    expect(probe.stdout).toContain("remote exact manifest");
    expect(probe.stdout).toContain('"providerDeploymentId":"deployment-2"');
    expect(probe.stdout).toContain("forbiddenTools=");
    expect(probe.stdout).not.toMatch(/forbiddenTools=\S/);
  });
});

function runtimeConfig(scope: string, remoteRoot: string) {
  const values: Record<string, unknown> = {
    RELEASE_BUILD_ARTIFACT_ROOT: join(scope, "artifacts"),
    RELEASE_DEPLOYMENT_SSH_HOST: process.env.F431_SSH_HOST || "127.0.0.1",
    RELEASE_DEPLOYMENT_SSH_PORT: Number(process.env.F431_SSH_PORT || 2225),
    RELEASE_DEPLOYMENT_SSH_USERNAME: process.env.F431_SSH_USERNAME || "deploy",
    RELEASE_DEPLOYMENT_SSH_PASSWORD:
      process.env.F431_SSH_PASSWORD || "devpilot-test",
    RELEASE_DEPLOYMENT_SSH_ROOT: remoteRoot,
    RELEASE_STAGING_DEPLOYMENT_TIMEOUT_MS: 20_000,
  };
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

function input(
  deploymentRunId: string,
  targetRef: string,
  artifact: { uri: string; digest: string },
  verified: { path: string; sizeBytes: number },
) {
  return {
    deploymentRunId,
    stage: "staging" as const,
    projectId: "project-1",
    releaseOrderId: "order-1",
    environmentId: "staging-1",
    targetRef,
    manifest: {
      id: "manifest-1",
      buildRunId: "build-1",
      uri: artifact.uri,
      digest: artifact.digest,
    },
    artifact: verified,
  };
}

function component() {
  return {
    key: "service-1",
    name: "api",
    workingDirectory: ".",
    buildCommand: "true",
    artifactOutputs: ["dist"],
    buildEnvironment: {},
  };
}

async function remoteProbe(
  provider: SshReleaseDeploymentProviderService,
  remoteRoot: string,
) {
  const transport = new SshTransportFactory().create(credentials());
  try {
    return await transport.execScript(
      `set -eu
cat '${remoteRoot}/project-1/staging-1/releases/deployment-1/dist/app.txt'
tr -d '\n ' < '${remoteRoot}/project-1/staging-1/active.json'
printf '\nforbiddenTools='
for tool in git node npm pnpm yarn; do command -v "$tool" 2>/dev/null || true; done
`,
      { timeoutMs: 20_000 },
    );
  } finally {
    await transport.dispose?.();
  }
}

async function cleanupRemote(
  _provider: SshReleaseDeploymentProviderService,
  remoteRoot: string,
) {
  const transport = new SshTransportFactory().create(credentials());
  try {
    await transport.execScript(`rm -rf '${remoteRoot}'\n`, {
      timeoutMs: 20_000,
    });
  } finally {
    await transport.dispose?.();
  }
}

function credentials() {
  return {
    host: process.env.F431_SSH_HOST || "127.0.0.1",
    port: Number(process.env.F431_SSH_PORT || 2225),
    username: process.env.F431_SSH_USERNAME || "deploy",
    password: process.env.F431_SSH_PASSWORD || "devpilot-test",
  };
}

async function deployOrExplain(
  provider: SshReleaseDeploymentProviderService,
  deployment: Parameters<
    SshReleaseDeploymentProviderService["deployExactManifest"]
  >[0],
) {
  try {
    return await provider.deployExactManifest(deployment);
  } catch (error) {
    if (error instanceof ReleaseDeploymentProviderError) {
      throw new Error(JSON.stringify(error.detail));
    }
    throw error;
  }
}
