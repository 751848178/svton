import { randomUUID } from "node:crypto";
import { ServerExecutionInput } from "../server-executor.types";
import { renderEnvWriteCommandReal } from "../../deployment/deployment-env-injection.utils";

export function buildSshLiveScript(input: ServerExecutionInput) {
  const lines = ["set -euo pipefail"];

  for (const step of input.steps) {
    if (!step.command) continue;
    lines.push("", `# ${step.label}`);
    if (step.cwd) {
      lines.push(`cd ${shellQuote(step.cwd)}`);
    }
    // Steps that carry `secretEnv` ship a redacted `command` (safe to persist
    // in commandPlan); the executor rebuilds the real heredoc here, at the
    // last moment, so secret values never enter the persisted plan.
    if (step.secretEnv && Object.keys(step.secretEnv).length > 0) {
      lines.push(renderEnvWriteCommandReal(step.secretEnv));
      continue;
    }
    lines.push(step.command);
  }

  return `${lines.join("\n")}\n`;
}

export function buildSshLiveRemoteWrappedScript(input: ServerExecutionInput) {
  const innerScript = buildSshLiveScript(input).trimEnd();
  const delimiter = `__DEVPILOT_SCRIPT_${randomUUID().replace(/-/g, "")}`;

  return [
    "set -euo pipefail",
    '__devpilot_tmp="$(mktemp -t devpilot-ssh.XXXXXX)"',
    `cat > "$__devpilot_tmp" <<'${delimiter}'`,
    innerScript,
    delimiter,
    'chmod 700 "$__devpilot_tmp"',
    '__devpilot_child_pid=""',
    "__devpilot_cleanup() {",
    '  status="${1:-130}"',
    '  if [ -n "${__devpilot_child_pid:-}" ] && kill -0 "$__devpilot_child_pid" 2>/dev/null; then',
    '    kill -TERM -- "-$__devpilot_child_pid" 2>/dev/null || kill -TERM "$__devpilot_child_pid" 2>/dev/null || true',
    "    sleep 2",
    '    kill -KILL -- "-$__devpilot_child_pid" 2>/dev/null || kill -KILL "$__devpilot_child_pid" 2>/dev/null || true',
    "  fi",
    '  rm -f "$__devpilot_tmp"',
    '  exit "$status"',
    "}",
    "trap '__devpilot_cleanup 130' INT TERM HUP",
    "if command -v setsid >/dev/null 2>&1; then",
    '  setsid bash "$__devpilot_tmp" &',
    "else",
    '  bash "$__devpilot_tmp" &',
    "fi",
    '__devpilot_child_pid="$!"',
    'echo "__DEVPILOT_REMOTE_CHILD_PID__=$__devpilot_child_pid" >&2',
    "set +e",
    'wait "$__devpilot_child_pid"',
    '__devpilot_status="$?"',
    "set -e",
    'rm -f "$__devpilot_tmp"',
    'exit "$__devpilot_status"',
    "",
  ].join("\n");
}

export function buildSshLiveRemoteKillCommand(pid: number) {
  return [
    `pid=${pid}`,
    'if kill -0 "$pid" 2>/dev/null; then',
    'kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true',
    "sleep 2",
    'kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true',
    "fi",
  ].join("; ");
}

export function readSshLiveRemoteProcessPid(value: string) {
  const matches = [...value.matchAll(/__DEVPILOT_REMOTE_CHILD_PID__=(\d+)/g)];
  const latest = matches.at(-1)?.[1];
  if (!latest) return undefined;
  const pid = Number(latest);
  return Number.isSafeInteger(pid) && pid > 1 ? pid : undefined;
}

export function stripSshLiveRemoteControlMarkers(value: string) {
  return value.replace(/^__DEVPILOT_REMOTE_CHILD_PID__=\d+\r?\n?/gm, "");
}

function shellQuote(value: string) {
  if (/^[a-zA-Z0-9_./:=@+-]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, "'\\''")}'`;
}
