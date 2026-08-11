import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertExternalOciJob, dockerCreateArguments } from "./release-build-external-oci.policy";
import { dependencyFetcherCreateArguments, dependencyNetworkCreateArguments,
  dependencyProxyConnectArguments, dependencyProxyCreateArguments,
  type DependencyNetworkJob } from "./release-dependency-network.policy";

describe("external OCI launcher argv policy", () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "oci-job-policy-")); });
  afterEach(async () => rm(root, { recursive: true, force: true }));

  it("emits only the fixed per-job isolation and broker command", async () => {
    const job = await fixture();
    await expect(assertExternalOciJob(job, root)).resolves.toBeUndefined();
    const args = dockerCreateArguments(job);
    expect(args).toEqual(expect.arrayContaining([
      "--label", "devpilot.release-build.launcher=launcher_instance_01",
      "--network", "none", "--read-only", "--cap-drop", "ALL",
      "--security-opt", "no-new-privileges", "--user", "3000:3000",
      job.image, "node",
      "/app/apps/devpilot-api/dist/release-delivery/release-build-filesystem-broker.main.js",
      "/job/broker-input.json",
    ]));
    expect(args.join(" ")).not.toMatch(/docker\.sock|worker-hmac|\/exchange/);
    expect(args.filter((arg) => arg.startsWith("--mount="))).toHaveLength(5);
  });

  it("rejects mutable images and paths outside the private job", async () => {
    const job = await fixture();
    await expect(assertExternalOciJob({ ...job, image: "registry.test/api:latest" }, root))
      .rejects.toThrow("identity");
    await expect(assertExternalOciJob({ ...job, sourceRoot: tmpdir() }, root))
      .rejects.toThrow("escapes");
  });

  it("runs the trusted fetcher with only lock control and store output mounts", async () => {
    const job = await fixture();
    const network: DependencyNetworkJob = {
      fetchName: "dp-fetch-0123456789abcdef", proxyName: "dp-proxy-0123456789abcdef",
      networkName: "dp-net-0123456789abcdef", launcherLabel: job.launcherLabel,
      image: job.image, controlRoot: job.controlRoot, outputRoot: job.outputRoot };
    const args = dependencyFetcherCreateArguments(network);
    expect(args).toEqual(expect.arrayContaining([
      "--network", network.networkName, "--read-only", "--cap-drop", "ALL",
      "HTTPS_PROXY=http://registry-egress-proxy:3128",
      "npm_config_registry=https://registry.npmjs.org",
      "/app/apps/devpilot-api/dist/release-delivery/release-dependency-fetcher.main.js",
    ]));
    expect(args.filter((arg) => arg.startsWith("--mount="))).toHaveLength(2);
    expect(args.join(" ")).not.toMatch(/\/source|docker\.sock|HMAC|secret/i);
    expect(dependencyNetworkCreateArguments(network)).toContain("--internal");
    expect(dependencyProxyCreateArguments(network)).toEqual(expect.arrayContaining([
      "--network", "bridge", network.image, "node",
      "/app/apps/devpilot-api/dist/release-delivery/release-registry-egress-proxy.main.js",
    ]));
    expect(dependencyProxyConnectArguments(network)).toEqual([
      "network", "connect", "--alias", "registry-egress-proxy",
      network.networkName, network.proxyName]);
  });

  async function fixture() {
    const paths = ["control", "source", "dependency", "work", "output"]
      .map((value) => join(root, value));
    await Promise.all(paths.map((path) => mkdir(path)));
    return { name: "dp-build-0123456789abcdef", image:
      `registry.test/devpilot/api@sha256:${"a".repeat(64)}`,
    launcherLabel: "launcher_instance_01",
    controlRoot: paths[0], sourceRoot: paths[1], dependencyStoreRoot: paths[2],
    workRoot: paths[3], outputRoot: paths[4] };
  }
});
