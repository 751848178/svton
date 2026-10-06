function validatePidVariable(pidVariable: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(pidVariable)) {
    throw new Error("managed process PID variable is invalid");
  }
}

export function buildReleaseProcessGroupRunningCheck(pidVariable: string) {
  validatePidVariable(pidVariable);
  const pid = `$${pidVariable}`;
  return `release_process_group_is_running() {
  kill -0 "-${pid}" 2>/dev/null || return 1
  group_states="$(ps -o stat= -g "${pid}" 2>/dev/null)" || return 0
  [ -n "$group_states" ] || return 0
  printf '%s\n' "$group_states" | grep -Eqv '^[[:space:]]*[ZX]'
}`;
}

export function buildReleaseProcessGroupStopScript(
  pidVariable: string,
  failureCommand = "exit 1",
) {
  validatePidVariable(pidVariable);
  if (failureCommand !== "exit 1" && failureCommand !== "return 1") {
    throw new Error("managed process failure command is invalid");
  }
  const pid = `$${pidVariable}`;
  return `case "${pid}" in ''|*[!0-9]*) ${failureCommand};; esac
${buildReleaseProcessGroupRunningCheck(pidVariable)}
if release_process_group_is_running; then
  kill -TERM "-${pid}" 2>/dev/null || true
  attempt=1
  while release_process_group_is_running && [ "$attempt" -le 20 ]; do
    sleep 0.1
    attempt=$((attempt + 1))
  done
fi
if release_process_group_is_running; then
  kill -KILL "-${pid}" 2>/dev/null || true
  attempt=1
  while release_process_group_is_running && [ "$attempt" -le 20 ]; do
    sleep 0.1
    attempt=$((attempt + 1))
  done
fi
release_process_group_is_running && ${failureCommand}`;
}
