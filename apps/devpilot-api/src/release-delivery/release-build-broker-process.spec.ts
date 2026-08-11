import { brokerChildSpawnOptions } from "./release-build-broker-process";

describe("release build broker child boundary", () => {
  it("passes only fixed non-secret process settings and three stdio descriptors", () => {
    const options = brokerChildSpawnOptions({
      broker: {
        version: 1,
        request: { version: 1 } as never,
        jobRoot: "/work/jobs/random-job",
        workRoot: "/work/jobs/random-job/work",
        buildRoot: "/work/jobs/random-job/work/source",
        dependencyStoreRoot: "/work/jobs/random-job/dependency-store",
        artifactRoot: "/work/jobs/random-job/raw-artifacts",
        supplyProofFile: "/work/jobs/random-job/control/supply-proof.json",
        commandPath: "/usr/local/bin:/usr/bin:/bin",
        commandTimeoutMs: 1_000,
        cancelGraceMs: 50,
        prepared: { security: {}, sourceSnapshot: {
          sourceCommitSha: "a".repeat(40), treeHash: "tree", snapshotDigest: "snapshot",
        } },
      },
      brokerUid: 3_000,
      brokerGid: 3_000,
    });
    expect(options).toMatchObject({
      uid: 3_000, gid: 3_000, detached: true, shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    expect(Object.keys(options.env!)).toEqual([
      "NODE_ENV", "PATH", "HOME", "TMPDIR", "LANG",
    ]);
    expect(JSON.stringify(options)).not.toMatch(/SECRET|HMAC|exchange|inputRoot|outputRoot/i);
  });
});
