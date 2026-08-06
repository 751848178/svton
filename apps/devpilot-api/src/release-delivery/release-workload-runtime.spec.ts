import { runReleaseWorkloads } from "./release-workload-runtime";
import type { ReleaseStagingWorkloadSnapshot } from "./release-staging-workload.types";

describe("release workload runtime", () => {
  it("rejects direct provider input that overrides an executable loader", async () => {
    const execute = jest.fn();
    await expect(
      runReleaseWorkloads({
        snapshot: snapshot(),
        releaseRoot: "/srv/releases/run-1",
        runtimePath: "/srv/releases/run-1/.devpilot/runtime.env",
        runtimeEnvironment: { NODE_OPTIONS: "--require source.js" },
        execute,
      }),
    ).rejects.toThrow("不得覆盖执行控制边界");
    expect(execute).not.toHaveBeenCalled();
  });

  it("starts and probes exact-release services without exposing commands", async () => {
    const scripts: string[] = [];
    const result = await runReleaseWorkloads({
      snapshot: snapshot(),
      releaseRoot: "/srv/releases/run-1",
      runtimePath: "/srv/releases/run-1/.devpilot/runtime.env",
      runtimeEnvironment: { API_TOKEN: "secret-runtime-value" },
      execute: jest.fn(async (script) => {
        scripts.push(script);
        return success(script.includes("curl") ? "HTTP_STATUS=204\n" : "");
      }),
    });

    expect(result.evidence).toMatchObject({
      workloadReady: {
        status: "passed",
        serviceCount: 2,
        services: [
          { serviceId: "api", processStatus: "running", httpStatus: 204 },
          { serviceId: "worker", processStatus: "running" },
        ],
      },
      healthProbe: { status: "passed", processChecks: 2, httpChecks: 1 },
      httpProbe: { status: "passed", checkedServices: 1 },
    });
    expect(scripts.join("\n")).toContain("/srv/releases/run-1");
    expect(scripts.join("\n")).not.toContain("/workspace/source");
    expect(scripts.join("\n")).not.toContain("/bin/sh -lc");
    expect(JSON.stringify(result)).not.toContain("node dist/api.js");
  });

  it("redacts runtime values, retains diagnostics, and cleans a failed process", async () => {
    const scripts: string[] = [];
    const execute = jest.fn(async (script: string) => {
      scripts.push(script);
      if (script.includes("curl")) {
        return failure("secret-runtime-value health failure");
      }
      if (script.includes("tail -n")) {
        return success("secret-runtime-value crashed\n");
      }
      return success();
    });

    await expect(
      runReleaseWorkloads({
        snapshot: { ...snapshot(), services: [snapshot().services[0]] },
        releaseRoot: "/srv/releases/run-1",
        runtimePath: "/srv/releases/run-1/.devpilot/runtime.env",
        runtimeEnvironment: { API_TOKEN: "secret-runtime-value" },
        execute,
      }),
    ).rejects.toMatchObject({
      detail: {
        code: "WORKLOAD_HEALTH_FAILED",
        logs: expect.arrayContaining([expect.stringContaining("[REDACTED]")]),
      },
    });
    expect(scripts.join("\n")).toContain('kill -TERM "-$pid"');
    expect(scripts.join("\n")).toContain('kill -KILL "-$pid"');
    expect(
      scripts.filter((script) => script.startsWith("set -eu\nstop_file="))
        .length,
    ).toBe(1);
  });

  it("retains an asserted managed-command cleanup failure", async () => {
    const worker = snapshot().services[1];
    const execute = jest.fn(async (script: string) => {
      if (script.includes("worker-status.sh")) return failure("not running");
      if (script.startsWith("set -eu\nstop_file=")) {
        return failure("still alive");
      }
      return success();
    });
    await expect(
      runReleaseWorkloads({
        snapshot: { ...snapshot(), services: [worker] },
        releaseRoot: "/srv/releases/run-1",
        runtimePath: "/srv/releases/run-1/.devpilot/runtime.env",
        runtimeEnvironment: {},
        execute,
      }),
    ).rejects.toMatchObject({
      detail: {
        code: "WORKLOAD_STATUS_FAILED",
        logs: expect.arrayContaining([
          expect.stringContaining("cleanup failed"),
        ]),
      },
    });
  });
});

function snapshot(): ReleaseStagingWorkloadSnapshot {
  return {
    version: 1,
    environmentId: "staging-1",
    manifestId: "manifest-1",
    manifestDigest: `sha256:${"a".repeat(64)}`,
    services: [
      {
        serviceId: "api",
        applicationId: "app-1",
        componentKey: "api",
        name: "api",
        kind: "static",
        artifactDigest: `sha256:${"b".repeat(64)}`,
        workingDirectory: ".",
        executionMode: "managed-process-v1",
        startCommand: "node dist/api.js",
        startTimeoutMs: 5_000,
        statusTimeoutMs: 1_000,
        health: {
          url: "http://127.0.0.1:4310/health",
          origin: "http://127.0.0.1:4310",
          maxAttempts: 2,
          intervalMs: 1,
          timeoutMs: 100,
        },
        stateHash: "api-state",
      },
      {
        serviceId: "worker",
        applicationId: "app-1",
        componentKey: "worker",
        name: "worker",
        kind: "container",
        artifactDigest: `sha256:${"c".repeat(64)}`,
        workingDirectory: ".",
        executionMode: "managed-command-v1",
        startCommand: "./worker-start.sh",
        statusCommand: "./worker-status.sh",
        failureCleanupCommand: "./worker-cleanup.sh",
        startTimeoutMs: 5_000,
        statusTimeoutMs: 1_000,
        stateHash: "worker-state",
      },
    ],
    inputHash: "workload-input",
  };
}

function success(stdout = "") {
  return {
    exitCode: 0,
    stdout,
    stderr: "",
    timedOut: false,
    cancelled: false,
  };
}

function failure(stderr: string) {
  return {
    exitCode: 1,
    stdout: "",
    stderr,
    timedOut: false,
    cancelled: false,
  };
}
