import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertExternalOciJob, dockerCreateArguments } from "./release-build-external-oci.policy";

describe("external OCI launcher argv policy", () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "oci-job-policy-")); });
  afterEach(async () => rm(root, { recursive: true, force: true }));

  it("emits only the fixed per-job isolation and broker command", async () => {
    const job = await fixture();
    await expect(assertExternalOciJob(job, root)).resolves.toBeUndefined();
    const args = dockerCreateArguments(job);
    expect(args).toEqual(expect.arrayContaining([
      "--network", "none", "--read-only", "--cap-drop", "ALL",
      "--security-opt", "no-new-privileges", "--user", "3000:3000",
      job.image, "node",
      "/app/apps/devpilot-api/dist/release-delivery/release-build-filesystem-broker.main.js",
      "/job/broker-input.json",
    ]));
    expect(args.join(" ")).not.toMatch(/docker\.sock|worker-hmac|\/exchange/);
    expect(args.filter((arg) => arg.startsWith("--mount="))).toHaveLength(4);
  });

  it("rejects mutable images and paths outside the private job", async () => {
    const job = await fixture();
    await expect(assertExternalOciJob({ ...job, image: "registry.test/api:latest" }, root))
      .rejects.toThrow("identity");
    await expect(assertExternalOciJob({ ...job, sourceRoot: tmpdir() }, root))
      .rejects.toThrow("escapes");
  });

  async function fixture() {
    const paths = ["control", "source", "work", "output"]
      .map((value) => join(root, value));
    await Promise.all(paths.map((path) => mkdir(path)));
    return { name: "dp-build-0123456789abcdef", image:
      `registry.test/devpilot/api@sha256:${"a".repeat(64)}`,
    controlRoot: paths[0], sourceRoot: paths[1], workRoot: paths[2], outputRoot: paths[3] };
  }
});
