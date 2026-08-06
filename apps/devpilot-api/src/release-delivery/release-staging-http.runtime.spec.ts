import "reflect-metadata";
import type { ReleaseBuildHttpRuntimeFixture } from "./release-build-http-runtime.fixture";
import { verifyRejectedStagingHttpManifests } from "./release-staging-http-negative.fixture";
import {
  cleanupF431SshTarget,
  probeF431SshTarget,
} from "./release-staging-ssh-target.fixture";

const describeRuntime =
  process.env.RUN_F431_HTTP_RUNTIME === "1" ? describe : describe.skip;

jest.setTimeout(90_000);

describeRuntime(
  "F431 authenticated exact-Manifest Staging HTTP runtime",
  () => {
    let fixture: ReleaseBuildHttpRuntimeFixture;

    beforeAll(async () => {
      const module = await import("./release-build-http-runtime.fixture");
      fixture = new module.ReleaseBuildHttpRuntimeFixture();
      await fixture.start();
    });

    afterAll(async () => {
      await cleanupF431SshTarget();
      await fixture?.stop();
    });

    it("repeats one Manifest through real JWT, MySQL, storage, and SSH without source", async () => {
      await fixture.configureBuild({
        workingDirectory: ".",
        buildCommand:
          "node -e \"const fs=require('fs');fs.mkdirSync('dist',{recursive:true});fs.writeFileSync('dist/app.txt','http exact manifest')\"",
        artifactPaths: ["dist"],
      });
      const buildResponse = await fixture.request(fixture.buildsPath(), {
        method: "POST",
      });
      expect(buildResponse.ok).toBe(true);
      const buildBody = (await buildResponse.json()) as { data: Build };
      if (buildBody.data.status !== "succeeded") {
        throw new Error(`HTTP Build failed: ${JSON.stringify(buildBody.data)}`);
      }
      const manifestId = buildBody.data.manifest.id;
      const beforeBuilds = await fixture.git.prisma.buildRun.count({
        where: { releaseOrderId: fixture.git.orderId },
      });
      await fixture.git.takeOffline();
      const first = await deploy(manifestId);
      const second = await deploy(manifestId);
      expect(first.id).not.toBe(second.id);
      for (const run of [first, second]) {
        expect(run).toMatchObject({
          status: "completed",
          artifactManifestId: manifestId,
          adapterKey: "ssh-v1",
          result: {
            providerKey: "ssh-v1",
            remoteDigestVerified: true,
            buildInvoked: false,
            gitInvoked: false,
          },
        });
        expect(run.params).toMatchObject({
          configRevisionId: expect.any(String),
          deploymentInput: {
            configRevision: {
              snapshotHash: "f432-http-config",
              stateHash: expect.any(String),
            },
            runtimeEnvironmentKeys: [
              "DATABASE_HOST",
              "DATABASE_PASSWORD",
              "HTTP_DEPLOY_SECRET",
              "HTTP_PLAIN_F432",
            ],
            target: {
              providerKey: "ssh-v1",
              targetRef: expect.stringContaining("127.0.0.1:2225"),
            },
          },
        });
        expect(JSON.stringify(run)).not.toContain("http-secret-sentinel-f432");
        expect(JSON.stringify(run)).not.toContain(
          "http-resource-sentinel-f432",
        );
      }
      await expect(
        fixture.git.prisma.buildRun.count({
          where: { releaseOrderId: fixture.git.orderId },
        }),
      ).resolves.toBe(beforeBuilds);
      await expect(
        fixture.git.prisma.deploymentRun.count({
          where: { artifactManifestId: manifestId },
        }),
      ).resolves.toBe(2);
      const remote = await probeF431SshTarget(first.id, second.id);
      if (remote.exitCode !== 0) {
        throw new Error(`SSH target probe failed: ${JSON.stringify(remote)}`);
      }
      expect(remote.stdout).toContain("http exact manifest");
      expect(remote.stdout).toContain(`"providerDeploymentId":"${second.id}"`);
      expect(remote.stdout).toContain(
        "HTTP_DEPLOY_SECRET=http-secret-sentinel-f432",
      );
      expect(remote.stdout).toContain(
        "DATABASE_PASSWORD=http-resource-sentinel-f432",
      );
      expect(remote.stdout).toContain(
        "HTTP_PLAIN_F432=http-plain-sentinel-f432",
      );
      expect(remote.stdout).toContain("runtimeMode=600");
      expect(remote.stdout).not.toMatch(/forbiddenTools=\S/);
      await expectDatabaseEvidenceToBeSecretSafe();
      await verifyRejectedStagingHttpManifests(fixture);
    });

    async function expectDatabaseEvidenceToBeSecretSafe() {
      const prisma = fixture.git.prisma;
      const [runs, secrets, resources, servers] = await Promise.all([
        prisma.deploymentRun.findMany({
          where: { teamId: fixture.git.teamId },
          select: { params: true, logs: true, result: true, error: true },
        }),
        prisma.secretKey.findMany({
          where: { teamId: fixture.git.teamId },
          select: { value: true },
        }),
        prisma.resourceInstance.findMany({
          where: { teamId: fixture.git.teamId },
          select: { credentials: true },
        }),
        prisma.server.findMany({
          where: { teamId: fixture.git.teamId },
          select: { credentials: true },
        }),
      ]);
      const evidence = JSON.stringify({ runs, secrets, resources, servers });
      for (const value of [
        "http-secret-sentinel-f432",
        "http-resource-sentinel-f432",
        "devpilot-test",
      ]) {
        expect(evidence).not.toContain(value);
      }
    }

    async function deploy(manifestId: string) {
      const response = await fixture.request(fixture.stagingPath(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ manifestId }),
      });
      const body = (await response.json()) as {
        data?: Deployment;
        message?: string;
      };
      if (!response.ok || !body.data) {
        throw new Error(
          `Staging HTTP ${response.status}: ${JSON.stringify(body)}`,
        );
      }
      return body.data;
    }
  },
);

interface Build {
  id: string;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  logSummary: unknown;
  manifest: { id: string; digest: string };
}

interface Deployment {
  id: string;
  status: string;
  artifactManifestId: string;
  adapterKey: string;
  params: Record<string, unknown>;
  result: Record<string, unknown>;
}
