import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const calls: string[][] = [];
let failStart = false;
jest.mock("node:child_process", () => ({
  spawn: (_executable: string, args: string[]) => {
    calls.push(args);
    const child = new EventEmitter() as EventEmitter & {
      stdout: PassThrough; stderr: PassThrough; kill: jest.Mock;
    };
    child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.kill = jest.fn();
    setImmediate(() => {
      if (args[0] === "start" && failStart) {
        child.stderr.end("fixture start failure"); child.emit("close", 1);
      } else {
        if (args[0] === "start") child.stdout.end(JSON.stringify({
          version: 1, status: "succeeded", result: { artifact: {}, logs: [], gateSummary: {} },
        }));
        if (args[0] === "ps") child.stdout.end("abcdef123456\n123456abcdef\n");
        if (args[0] === "network" && args[1] === "ls")
          child.stdout.end("fedcba654321\n");
        child.emit("close", 0);
      }
    });
    return child;
  },
}));

import { cleanupExternalOciLauncherContainers,
  runExternalOciBroker } from "./release-build-external-oci-runner";

const describeRootLinux = process.platform === "linux" && process.getuid?.() === 0
  ? describe : describe.skip;

describeRootLinux("external OCI broker lifecycle", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "oci-runner-")); calls.length = 0; failStart = false;
    await Promise.all([mkdir(join(root, "source")), mkdir(join(root, "output")),
      mkdir(join(root, "dependency-store"))]);
  });
  afterEach(async () => rm(root, { recursive: true, force: true }));

  it("removes the complete job container before returning the result", async () => {
    await expect(run()).resolves.toMatchObject({ status: "succeeded" });
    expect(calls.map((value) => value[0])).toEqual(["create", "start", "kill", "rm"]);
    expect(calls[3]).toEqual(expect.arrayContaining(["--force"]));
  });

  it("kills and removes the container when its broker fails", async () => {
    failStart = true;
    await expect(run()).rejects.toThrow("fixture start failure");
    expect(calls.map((value) => value[0])).toEqual(["create", "start", "kill", "rm"]);
  });

  function run() {
    return runExternalOciBroker({
      broker: { version: 1, request: { version: 1, identity: {
        jobId: "job_0123456789", buildRunId: "build", projectId: "project",
      } } as never, jobRoot: root, workRoot: join(root, "unused"),
      buildRoot: join(root, "source"), artifactRoot: join(root, "output"),
      dependencyStoreRoot: join(root, "dependency-store"),
      supplyProofFile: join(root, "unused-proof"), commandPath: "/usr/bin:/bin",
      commandTimeoutMs: 1_000, cancelGraceMs: 50,
      prepared: { security: {}, sourceSnapshot: {
        sourceCommitSha: "a".repeat(40), treeHash: "tree", snapshotDigest: "snapshot",
      } } },
      supplyProof: {} as never,
      image: `registry.test/devpilot/api@sha256:${"a".repeat(64)}`,
      dockerExecutable: "/usr/bin/docker", timeoutMs: 1_000,
      launcherLabel: "launcher_instance_01",
    });
  }
});

describe("external OCI launcher stale cleanup", () => {
  beforeEach(() => { calls.length = 0; failStart = false; });
  it("cleans only containers selected by the exact launcher label", async () => {
    await cleanupExternalOciLauncherContainers({ dockerExecutable: "/usr/bin/docker",
      launcherLabel: "launcher_instance_01" });
    expect(calls[0]).toEqual(["ps", "--all", "--quiet", "--filter",
      "label=devpilot.release-build.launcher=launcher_instance_01"]);
    expect(calls.slice(1)).toEqual([
      ["rm", "--force", "abcdef123456"], ["rm", "--force", "123456abcdef"],
      ["network", "ls", "--quiet", "--filter",
        "label=devpilot.release-build.launcher=launcher_instance_01"],
      ["network", "rm", "fedcba654321"],
    ]);
  });
});
