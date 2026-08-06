import { SshTransportFactory } from "../common/ssh/ssh-transport.factory";
import { sshIntegrationCredentials } from "./ssh-release-deployment-provider.integration-fixture";

export async function probeSshReleaseWorkloadTarget(
  remoteRoot: string,
  portBase: number,
) {
  const transport = new SshTransportFactory().create(
    sshIntegrationCredentials(),
  );
  try {
    return await transport.execScript(
      `set -eu
release='${remoteRoot}/project-f433/staging-f433/releases/deployment-f433-3'
for service in frontend backend static worker; do
  pid="$(cat "$release/.devpilot/workloads/$service.pid")"
  kill -0 "-$pid"
  printf 'PROCESS_%s=running\n' "$service"
done
for offset in 0 1 2; do curl -fsS "http://127.0.0.1:$((${portBase} + offset))/"; done
tr -d '\n ' < '${remoteRoot}/project-f433/staging-f433/active.json'
test -e '${remoteRoot}/project-f433/staging-f433/releases/deployment-f433-1/.devpilot/workloads/worker.stopped'
test -e '${remoteRoot}/project-f433/staging-f433/releases/deployment-f433-2/.devpilot/workloads/worker.stopped'
test ! -e '${remoteRoot}/project-f433/staging-f433/releases/deployment-f433-2/dist/worker/worker.pid'
printf '\nMODE_TRANSITIONS=clean\n'
`,
      { timeoutMs: 20_000 },
    );
  } finally {
    await transport.dispose?.();
  }
}

export async function cleanupSshReleaseWorkloadTarget(remoteRoot: string) {
  const transport = new SshTransportFactory().create(
    sshIntegrationCredentials(),
  );
  try {
    await transport.execScript(
      `set -eu
pids=''
for pid_file in '${remoteRoot}'/project-f433/staging-f433/releases/*/.devpilot/workloads/*.pid '${remoteRoot}'/project-f433/staging-f433/releases/*/dist/worker/worker.pid; do
  [ -s "$pid_file" ] || continue
  pid="$(cat "$pid_file")"
  case "$pid" in ''|*[!0-9]*) exit 1;; esac
  pids="$pids $pid"
  kill -TERM "-$pid" 2>/dev/null || true
done
sleep 1
for pid in $pids; do
  kill -0 "-$pid" 2>/dev/null && kill -KILL "-$pid" 2>/dev/null || true
done
sleep 1
for pid in $pids; do ! kill -0 "-$pid" 2>/dev/null; done
rm -rf '${remoteRoot}'
`,
      { timeoutMs: 20_000 },
    );
  } finally {
    await transport.dispose?.();
  }
}
