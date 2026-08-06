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
      expect(remote.stdout).not.toMatch(/forbiddenTools=\S/);
      await verifyRejectedStagingHttpManifests(fixture);
    });

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
  result: Record<string, unknown>;
}
