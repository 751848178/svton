import { ReleaseDeploymentProviderError } from "./release-deployment-provider.types";
import type { ReleaseStagingWorkloadSnapshot } from "./release-staging-workload.types";
import { SshReleaseDeploymentProviderService } from "./ssh-release-deployment-provider.service";

export async function deploySshWorkloadOrExplain(
  provider: SshReleaseDeploymentProviderService,
  input: Parameters<
    SshReleaseDeploymentProviderService["deployExactManifest"]
  >[0],
) {
  try {
    return await provider.deployExactManifest(input);
  } catch (error) {
    if (error instanceof ReleaseDeploymentProviderError) {
      throw new Error(JSON.stringify(error.detail));
    }
    throw error;
  }
}

export function sshWorkloadComponents() {
  return ["frontend", "backend", "static", "worker"].map((key) => ({
    key,
    name: key,
    workingDirectory: ".",
    buildCommand: "true",
    artifactOutputs: [`dist/${key}`],
    buildEnvironment: {},
  }));
}

export function sshWorkloadSnapshot(
  items: Array<{ key: string; digest: string }>,
  manifestDigest: string,
  portBase: number,
  workerMode: "managed-process-v1" | "managed-command-v1",
): ReleaseStagingWorkloadSnapshot {
  const services = items.map((item, index) => ({
    serviceId: item.key,
    applicationId: "application-f433",
    componentKey: item.key,
    name: item.key,
    kind: item.key,
    artifactDigest: item.digest,
    workingDirectory: `dist/${item.key}`,
    executionMode:
      item.key === "worker" ? workerMode : ("managed-process-v1" as const),
    startCommand:
      item.key === "worker" && workerMode === "managed-command-v1"
        ? "sh worker-start.sh"
        : item.key === "worker"
          ? "sh worker-loop.sh"
          : "sh server.sh",
    ...(item.key === "worker" && workerMode === "managed-command-v1"
      ? {
          statusCommand: "sh worker-status.sh",
          failureCleanupCommand: "sh worker-cleanup.sh",
        }
      : {}),
    startTimeoutMs: 10_000,
    statusTimeoutMs: 5_000,
    ...(item.key === "worker"
      ? {}
      : {
          health: {
            url: `http://127.0.0.1:${portBase + index}/`,
            origin: `http://127.0.0.1:${portBase + index}`,
            maxAttempts: 10,
            intervalMs: 200,
            timeoutMs: 1_000,
          },
        }),
    stateHash: `${item.key}-state-f433`,
  }));
  return {
    version: 1,
    environmentId: "staging-f433",
    manifestId: "manifest-f433",
    manifestDigest,
    services,
    inputHash: "workload-input-f433",
  };
}

export function sshWorkloadFiles(key: string, port: number) {
  if (key !== "worker") {
    return [
      {
        name: "server.sh",
        body: `while :; do\n  { printf 'HTTP/1.0 200 OK\\r\\n\\r\\n'; cat index.html; } | nc -l -p ${port} -q 1\ndone\n`,
      },
    ];
  }
  return [
    {
      name: "worker-loop.sh",
      body: "trap '' TERM\nwhile :; do sleep 5; done\n",
    },
    {
      name: "worker-start.sh",
      body: 'setsid sh worker-loop.sh >/dev/null 2>&1 </dev/null &\nprintf \'%s\\n\' "$!" > worker.pid\nsleep 1\nkill -0 "-$(cat worker.pid)"\n',
    },
    {
      name: "worker-status.sh",
      body: 'pid=$(cat worker.pid)\nkill -0 "-$pid"\n',
    },
    {
      name: "worker-cleanup.sh",
      body: 'pid=$(cat worker.pid 2>/dev/null || true)\ncase "$pid" in \'\'|*[!0-9]*) exit 0;; esac\nkill -TERM "-$pid" 2>/dev/null || true\nsleep 1\nkill -KILL "-$pid" 2>/dev/null || true\nrm -f worker.pid\nsleep 0.2\n! kill -0 "-$pid" 2>/dev/null\n',
    },
  ];
}
