import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { exactOciImage } from "./release-build-launcher-proof.policy";
import { runExternalOciBroker } from "./release-build-external-oci-runner";

const exec = promisify(execFile);
const image = process.env.RELEASE_BUILD_OCI_INTEGRATION_IMAGE;
const describeDocker = process.platform === "linux" && process.getuid?.() === 0 &&
  process.env.RELEASE_BUILD_OCI_INTEGRATION === "1" && exactOciImage(image)
  ? describe : describe.skip;

describeDocker("external OCI launcher real Docker boundary", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "oci-launcher-real-"));
    await Promise.all([mkdir(join(root, "source")), mkdir(join(root, "output"))]);
  });
  afterEach(async () => rm(root, { recursive: true, force: true }));

  it("runs in an outer container and leaves no job container behind", async () => {
    const jobId = "real_oci_job_0123456789";
    const result = await runExternalOciBroker({
      broker: broker(root, jobId), supplyProof: {} as never, image: image!,
      dockerExecutable: "/usr/bin/docker", timeoutMs: 30_000,
    });
    expect(result.status).toBe("failed");
    const name = `dp-build-${createHash("sha256").update(jobId).digest("hex").slice(0, 24)}`;
    await expect(exec("/usr/bin/docker", ["inspect", name])).rejects.toBeDefined();
  });
});

function broker(root: string, jobId: string) {
  return { version: 1, request: { version: 1, identity: {
    jobId, buildRunId: "build", projectId: "project",
  } } as never, jobRoot: root, workRoot: join(root, "unused"),
  buildRoot: join(root, "source"), artifactRoot: join(root, "output"),
  supplyProofFile: join(root, "unused-proof"), commandPath: "/usr/bin:/bin",
  commandTimeoutMs: 1_000, cancelGraceMs: 50,
  prepared: { security: {}, sourceSnapshot: {
    sourceCommitSha: "a".repeat(40), treeHash: "tree", snapshotDigest: "snapshot",
  } } } as const;
}
