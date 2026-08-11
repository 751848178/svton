import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { access, chmod, chown, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { exactOciImage } from "./release-build-launcher-proof.policy";
import { resolveRegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import { runExternalOciBroker } from "./release-build-external-oci-runner";
import { expectedReleaseBuildSupplyProof } from "./release-build-supply-proof.policy";
import { createDependencyStoreManifest } from "./release-dependency-store-filesystem";

const exec = promisify(execFile);
const image = process.env.RELEASE_BUILD_OCI_INTEGRATION_IMAGE;
let storeDigest = "";
const describeDocker = process.platform === "linux" && process.getuid?.() === 0 &&
  process.env.RELEASE_BUILD_OCI_INTEGRATION === "1" && exactOciImage(image)
  ? describe : describe.skip;

describeDocker("external OCI launcher real Docker boundary", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "oci-launcher-real-"));
    await Promise.all([mkdir(join(root, "source")), mkdir(join(root, "output")),
      mkdir(join(root, "dependency-store", "store"), { recursive: true })]);
    const profile = resolveRegisteredReleaseBuildProfile("controlled-local-acceptance-v2")!;
    const manifest = await createDependencyStoreManifest({
      pendingRoot: join(root, "dependency-store"), combinationHash: "1".repeat(64),
      lockfileDigest: "2".repeat(64), profileId: profile.id,
      profileVersion: profile.profileVersion, pnpmVersion: "8.12.0",
      platformOs: "linux", platformArch: "arm64",
      registryPolicyDigest: profile.dependencyStorePolicy.registryPolicyDigest,
    });
    storeDigest = manifest.storeDigest;
    await writeFile(join(root, "dependency-store", "manifest.json"),
      JSON.stringify(manifest));
    await chown(join(root, "output"), 3_000, 3_000);
    await chmod(join(root, "output"), 0o700);
  });
  afterEach(async () => rm(root, { recursive: true, force: true }));

  it("runs in an outer container and leaves no job container behind", async () => {
    const jobId = "real_oci_job_0123456789";
    const result = await runExternalOciBroker({
      broker: broker(root, jobId), supplyProof: {} as never, image: image!,
      dockerExecutable: "/usr/bin/docker", timeoutMs: 30_000,
      launcherLabel: "launcher_integration_01",
    });
    expect(result.status).toBe("failed");
    const name = `dp-build-${createHash("sha256")
      .update(`launcher_integration_01:${jobId}`).digest("hex").slice(0, 24)}`;
    await expect(exec("/usr/bin/docker", ["inspect", name])).rejects.toBeDefined();
  });

  it("builds from a writable copy while preserving the read-only source", async () => {
    const source = join(root, "source");
    await writeFixture(source);
    const profile = resolveRegisteredReleaseBuildProfile("controlled-local-acceptance-v2")!;
    const result = await runExternalOciBroker({
      broker: broker(root, "real_oci_success_0123456789", true),
      supplyProof: expectedReleaseBuildSupplyProof(profile), image: image!,
      dockerExecutable: "/usr/bin/docker", timeoutMs: 120_000,
      launcherLabel: "launcher_integration_01",
    });
    expect(result.status).toBe("succeeded");
    await expect(access(join(source, "dist"))).rejects.toBeDefined();
    expect(result.result?.artifact.items).toHaveLength(1);
  });
});

function broker(root: string, jobId: string, success = false) {
  return { version: 1, request: { version: 1, identity: {
    jobId, buildRunId: "build", projectId: "project", releaseOrderId: "order",
    profileId: "controlled-local-acceptance-v2", sourceCommitSha: "a".repeat(40),
    dependency: { combinationHash: "1".repeat(64), storeDigest },
  }, components: success ? [{ key: "api", name: "api", workingDirectory: ".",
    buildCommand: "pnpm run build", artifactOutputs: ["dist"], buildEnvironment: {} }] : []
  } as never, jobRoot: root, workRoot: join(root, "unused"),
  buildRoot: join(root, "source"), artifactRoot: join(root, "output"),
  dependencyStoreRoot: join(root, "dependency-store"),
  supplyProofFile: join(root, "unused-proof"), commandPath: "/usr/bin:/bin",
  commandTimeoutMs: 1_000, cancelGraceMs: 50,
  prepared: { security: {}, sourceSnapshot: {
    sourceCommitSha: "a".repeat(40), treeHash: "tree", snapshotDigest: "snapshot",
  } } } as const;
}

async function writeFixture(source: string) {
  await Promise.all([
    writeFile(join(source, "package.json"), JSON.stringify({ scripts: {
      test: "node -e \"process.exit(0)\"", lint: "node -e \"process.exit(0)\"",
      typecheck: "node -e \"process.exit(0)\"", build: "node build.js",
    } })),
    writeFile(join(source, "pnpm-lock.yaml"), "lockfileVersion: '6.0'\nimporters:\n  .: {}\n"),
    writeFile(join(source, "build.js"),
      "require('fs').mkdirSync('dist');require('fs').writeFileSync('dist/app.js','ok')"),
  ]);
  await Promise.all([chmod(join(source, "package.json"), 0o444),
    chmod(join(source, "pnpm-lock.yaml"), 0o444), chmod(join(source, "build.js"), 0o444)]);
  await chmod(source, 0o555);
}
