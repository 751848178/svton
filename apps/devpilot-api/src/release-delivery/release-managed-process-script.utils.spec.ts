import {
  buildManagedReleaseWorkloadStartScript,
  buildManagedReleaseWorkloadStatusScript,
} from "./release-managed-process-script.utils";
import type {
  ReleaseStagingWorkload,
  ReleaseWorkloadPaths,
} from "./release-staging-workload.types";

describe("managed release workload scripts", () => {
  it("reconciles a legacy stop failure with the zombie-aware process check", () => {
    const script = buildManagedReleaseWorkloadStartScript(service(), paths());

    expect(script).toContain('if ! "$previous_base.stop"; then');
    expect(script).toContain('previous_pid_file="$previous_base.pid"');
    expect(script).toContain("release_previous_process_stop");
    expect(script).toContain("grep -Eqv");
  });

  it("does not report a zombie-only process group as running", () => {
    const script = buildManagedReleaseWorkloadStatusScript(service(), paths());

    expect(script).toContain("release_process_group_is_running");
    expect(script).toContain("grep -Eqv");
    expect(script).not.toContain('kill -0 "-$pid"\nprintf');
  });
});

function service(): ReleaseStagingWorkload {
  return {
    serviceId: "service-web",
    applicationId: "app-1",
    componentKey: "web",
    name: "web",
    kind: "web",
    artifactDigest: "sha256:test",
    workingDirectory: "apps/web",
    executionMode: "managed-process-v1",
    startCommand: "node dist/server.mjs 4310",
    startTimeoutMs: 10_000,
    statusTimeoutMs: 5_000,
    stateHash: "state-1",
  };
}

function paths(): ReleaseWorkloadPaths {
  return {
    releaseRoot: "/releases/current",
    runtimePath: "/releases/current/.devpilot/env/web.env",
  };
}
