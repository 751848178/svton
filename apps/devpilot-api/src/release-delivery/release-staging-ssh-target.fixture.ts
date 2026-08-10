import { SshTransportFactory } from "../common/ssh/ssh-transport.factory";

export async function probeF431SshTarget(firstId: string, secondId: string) {
  const root = requireRemoteRoot();
  const transport = new SshTransportFactory().create(credentials());
  try {
    return await transport.execScript(
      `set -eu
for file in $(find '${root}' -path '*/releases/${firstId}/dist/app.txt'); do cat "$file"; done
for file in $(find '${root}' -path '*/releases/${secondId}/dist/app.txt'); do cat "$file"; done
for file in $(find '${root}' -name active.json); do tr -d '\n ' < "$file"; done
printf '\nruntime='
for file in $(find '${root}' -path '*/releases/${secondId}/.devpilot/runtime.env'); do cat "$file"; stat -c 'runtimeMode=%a' "$file"; done
for file in $(find '${root}' -path '*/releases/${secondId}/.devpilot/workloads/*.pid'); do kill -0 "$(cat "$file")"; printf 'workloadProcess=running\n'; done
printf '\nforbiddenTools='
for tool in git node npm pnpm yarn; do command -v "$tool" 2>/dev/null || true; done
printf '\n'
`,
      { timeoutMs: 20_000 },
    );
  } finally {
    await transport.dispose?.();
  }
}

export async function cleanupF431SshTarget() {
  const root = process.env.RELEASE_DEPLOYMENT_SSH_ROOT;
  if (!root) return;
  const transport = new SshTransportFactory().create(credentials());
  try {
    await transport.execScript(
      `set +e
for pid_file in '${root}'/*/*/releases/*/.devpilot/workloads/*.pid; do
  [ -s "$pid_file" ] && kill -TERM "-$(cat "$pid_file")" 2>/dev/null || true
done
rm -rf '${root}'
`,
      { timeoutMs: 20_000 },
    );
  } finally {
    await transport.dispose?.();
  }
}

function requireRemoteRoot() {
  const root = process.env.RELEASE_DEPLOYMENT_SSH_ROOT;
  if (!root || !/^\/config\/[A-Za-z0-9_-]+$/.test(root)) {
    throw new Error("F431 SSH runtime root is missing or unsafe");
  }
  return root;
}

function credentials() {
  return {
    host:
      process.env.F432_BOUND_SSH_HOST ||
      process.env.RELEASE_DEPLOYMENT_SSH_HOST ||
      "127.0.0.1",
    port: Number(
      process.env.F432_BOUND_SSH_PORT ||
        process.env.RELEASE_DEPLOYMENT_SSH_PORT ||
        2225,
    ),
    username:
      process.env.F432_BOUND_SSH_USERNAME ||
      process.env.RELEASE_DEPLOYMENT_SSH_USERNAME ||
      "deploy",
    password:
      process.env.F432_BOUND_SSH_PASSWORD ||
      process.env.RELEASE_DEPLOYMENT_SSH_PASSWORD ||
      "devpilot-test",
  };
}
