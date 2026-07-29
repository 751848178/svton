import { randomUUID } from "node:crypto";
import { ServerExecutionInput } from "../server-executor.types";
import { renderEnvWriteCommandReal } from "../../deployment/deployment-env-injection.utils";

export function buildSshLiveScript(input: ServerExecutionInput) {
  const lines = ["set -euo pipefail"];

  for (const step of input.steps) {
    if (!step.command) continue;
    lines.push("", ...renderStepExecution(step));
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

function renderStepExecution(step: ServerExecutionInput["steps"][number]) {
  const key = step.key.replace(/[^a-zA-Z0-9_.:-]/g, "_");
  // F383 release-stage credential injection: when a step carries
  // `secretEnvExport`, the values are emitted as `export KEY=...` lines inside
  // the step's subshell so `$DEVPILOT_*` references in `command` expand to the
  // real (memory-only) values. These export lines live only in the transient
  // remote script and are never persisted (stripSecretEnv drops the field).
  const exportLines =
    step.secretEnvExport && Object.keys(step.secretEnvExport).length > 0
      ? Object.entries(step.secretEnvExport).map(
          ([k, v]) => `  export ${k}=${shellQuote(v)}`,
        )
      : [];
  const command =
    step.secretEnv && Object.keys(step.secretEnv).length > 0
      ? renderEnvWriteCommandReal(step.secretEnv)
      : step.command;
  const body = [
    `# ${step.label}`,
    `__devpilot_step_key=${shellQuote(key)}`,
    '__devpilot_step_started="$(date +%s)"',
    'printf "__DEVPILOT_STEP_START__|%s|%s\\n" "$__devpilot_step_key" "$__devpilot_step_started" >&2',
    "set +e",
    "(",
    ...(step.cwd ? [`  cd ${shellQuote(step.cwd)}`] : []),
    ...exportLines,
    indent(command),
    ")",
    '__devpilot_step_status="$?"',
    "set -e",
    '__devpilot_step_finished="$(date +%s)"',
    'printf "__DEVPILOT_STEP_END__|%s|%s|%s\\n" "$__devpilot_step_key" "$__devpilot_step_status" "$__devpilot_step_finished" >&2',
    'if [ "$__devpilot_step_status" -ne 0 ]; then',
    '  exit "$__devpilot_step_status"',
    "fi",
  ];
  return body;
}

function indent(value: string) {
  // heredoc 感知：cat > f <<'DELIM' ... DELIM 的正文行不得缩进，否则 bash 把缩进后的
  // 终止分隔符视为普通正文 → heredoc 永不闭合（"delimited by end-of-file"）→ 语法错误。
  // 检测 <<[-]'DELIM' 起始行后，正文与终止 DELIM 行保持第 0 列，其余行正常缩进 2 空格。
  const lines = value.split("\n");
  let heredocDelim: string | null = null;
  const out: string[] = [];
  for (const line of lines) {
    if (heredocDelim) {
      // heredoc 正文：原样输出；终止行（仅含分隔符）结束 heredoc。
      if (line.trim() === heredocDelim) heredocDelim = null;
      out.push(line);
      continue;
    }
    const start = line.match(/<<-?\s*['"]?([A-Za-z_][A-Za-z0-9_]*)['"]?/);
    if (start) heredocDelim = start[1];
    out.push(`  ${line}`);
  }
  return out.join("\n");
}
