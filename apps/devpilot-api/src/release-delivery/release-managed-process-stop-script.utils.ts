export function buildReleaseProcessGroupStopScript(pidVariable: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(pidVariable)) {
    throw new Error("managed process PID variable is invalid");
  }
  const pid = `$${pidVariable}`;
  return `case "${pid}" in ''|*[!0-9]*) exit 1;; esac
if kill -0 "-${pid}" 2>/dev/null; then
  kill -TERM "-${pid}" 2>/dev/null || true
  attempt=1
  while kill -0 "-${pid}" 2>/dev/null && [ "$attempt" -le 20 ]; do
    sleep 0.1
    attempt=$((attempt + 1))
  done
fi
if kill -0 "-${pid}" 2>/dev/null; then
  kill -KILL "-${pid}" 2>/dev/null || true
  attempt=1
  while kill -0 "-${pid}" 2>/dev/null && [ "$attempt" -le 20 ]; do
    sleep 0.1
    attempt=$((attempt + 1))
  done
fi
kill -0 "-${pid}" 2>/dev/null && exit 1`;
}
