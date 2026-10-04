
# ---- upgrade transaction: back up everything we are about to replace (M2-02) ----
HAD_OLD=0
OLD_VERSION=""
OLD_PORT=""
if [ -d "$INSTALL_DIR" ]; then
  HAD_OLD=1
  if [ -f "$INSTALL_DIR/VERSION" ]; then OLD_VERSION=$(cat "$INSTALL_DIR/VERSION"); fi
  # the restored agent must be probed on ITS port (the upgrade may have changed it)
  if [ -f "$UNIT_FILE" ]; then OLD_PORT=$(sed -n 's/^Environment=SHIP_AGENT_PORT=//p' "$UNIT_FILE" | tail -1); fi
fi
SECRETS_BAK="${SECRETS_FILE}.pre-upgrade"
UNIT_BAK="${UNIT_FILE}.pre-upgrade"
HAD_ENV=0
HAD_UNIT=0
if [ -f "$SECRETS_FILE" ]; then cp -p "$SECRETS_FILE" "$SECRETS_BAK"; HAD_ENV=1; fi
if [ -f "$UNIT_FILE" ]; then cp -p "$UNIT_FILE" "$UNIT_BAK"; HAD_UNIT=1; fi

cleanup_upgrade_artifacts() {
  rm -rf "$INSTALL_DIR.old" "$INSTALL_DIR.failed"
  if [ "$HAD_ENV" = 1 ]; then rm -f "$SECRETS_BAK"; fi
  if [ "$HAD_UNIT" = 1 ]; then rm -f "$UNIT_BAK"; fi
  return 0
}

start_without_systemd() {
  if [ -f "$INSTALL_DIR/agent.pid" ]; then kill "$(cat "$INSTALL_DIR/agent.pid")" 2>/dev/null || true; sleep 1; fi
  # the systemd path gets SHIP_AGENT_TOKEN from EnvironmentFile; source it here too
  set -a; . "$SECRETS_FILE"; set +a
  (cd / && nohup env SHIP_AGENT_ROLE="$ROLE" SHIP_AGENT_PORT="$AGENT_PORT" SHIP_AGENT_HOST="$AGENT_BIND" \
    SHIP_WORK_ROOT="$WORK_ROOT" node "$INSTALL_DIR/agent/server.js" > /var/log/ship-agent.log 2>&1 &
    echo $! > "$INSTALL_DIR/agent.pid")
}

write_secrets_file() {
  cat > "$SECRETS_FILE" <<EOF
SHIP_AGENT_TOKEN=${AGENT_TOKEN}
SHIP_PUSH_USER=${SHIP_PUSH_USER:-}
SHIP_PUSH_PASSWORD=${SHIP_PUSH_PASSWORD:-}
SHIP_PULL_USER=${SHIP_PULL_USER:-}
SHIP_PULL_PASSWORD=${SHIP_PULL_PASSWORD:-}
EOF
}

write_unit_file() {
  cat > "$UNIT_FILE" <<EOF
[Unit]
Description=ship agent (${ROLE})
After=network-online.target docker.service
Wants=network-online.target

[Service]
Environment=SHIP_AGENT_ROLE=${ROLE}
Environment=SHIP_AGENT_PORT=${AGENT_PORT}
Environment=SHIP_AGENT_HOST=${AGENT_BIND}
Environment=SHIP_WORK_ROOT=${WORK_ROOT}
EnvironmentFile=${SECRETS_FILE}
ExecStart=/usr/bin/env node ${INSTALL_DIR}/agent/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
}

health_body() { curl -fsS "http://127.0.0.1:${1}/health" 2>/dev/null || true; }
health_version() { printf '%s' "$1" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).version)}catch{console.log("?")}})'; }

# restore program + env + unit, restart the previous agent, and VERIFY the result.
# Exit codes: 4 upgrade failed, rollback verified · 5 rollback INCOMPLETE (M2-02/M2-R1).
rollback_and_fail() {
  local why="$1" rb=0 body="" running=""
  log "upgrade commit failed: $why — rolling back"
  if [ -d "$INSTALL_DIR.old" ]; then
    rm -rf "$INSTALL_DIR.failed"
    mv "$INSTALL_DIR" "$INSTALL_DIR.failed" 2>/dev/null || true
    mv "$INSTALL_DIR.old" "$INSTALL_DIR" 2>/dev/null || rb=1
  elif [ "$HAD_OLD" = 0 ]; then
    rm -rf "$INSTALL_DIR" "$INSTALL_DIR.failed"  # fresh install: nothing older to restore
  fi
  # HAD_OLD=1 without .old: the swap never moved the original — it is still in place
  if [ "$HAD_ENV" = 1 ]; then cp -p "$SECRETS_BAK" "$SECRETS_FILE" 2>/dev/null || rb=1; else rm -f "$SECRETS_FILE"; fi
  if [ "$HAD_UNIT" = 1 ] && [ "${SKIP_SYSTEMD:-0}" != 1 ]; then cp -p "$UNIT_BAK" "$UNIT_FILE" 2>/dev/null || rb=1; fi
  # the restart must use the RESTORED runtime values (role/port/...), not the
  # upgrade's new ones — re-read them from the restored unit when present
  if [ "$HAD_UNIT" = 1 ] && [ -f "$UNIT_BAK" ]; then
    ru() { sed -n "s/^Environment=$1=//p" "$UNIT_BAK" | tail -1; }
    if [ -n "$(ru SHIP_AGENT_ROLE)" ]; then ROLE="$(ru SHIP_AGENT_ROLE)"; fi
    if [ -n "$(ru SHIP_AGENT_PORT)" ]; then AGENT_PORT="$(ru SHIP_AGENT_PORT)"; fi
    if [ -n "$(ru SHIP_AGENT_HOST)" ]; then AGENT_BIND="$(ru SHIP_AGENT_HOST)"; fi
    if [ -n "$(ru SHIP_WORK_ROOT)" ]; then WORK_ROOT="$(ru SHIP_WORK_ROOT)"; fi
  fi
  if [ "${SKIP_SYSTEMD:-0}" = 1 ]; then
    start_without_systemd || rb=1
  else
    systemctl daemon-reload >/dev/null 2>&1 || rb=1
    systemctl restart ship-agent >/dev/null 2>&1 || rb=1
  fi
  sleep 2
  for _ in $(seq 1 15); do
    body="$(health_body "${OLD_PORT:-$AGENT_PORT}")"
    if [ -n "$body" ]; then break; fi
    sleep 2
  done
  if [ -z "$body" ]; then
    rb=1
  else
    running="$(health_version "$body")"
    # verify the ACTUAL restored version, not just that something listens (M2-02)
    if [ -n "$OLD_VERSION" ] && [ "$running" != "$OLD_VERSION" ]; then
      log "rollback verification: agent reports version ${running}, previous install was ${OLD_VERSION}"
      rb=1
    fi
  fi
  if [ "$HAD_ENV" = 1 ] && ! cmp -s "$SECRETS_BAK" "$SECRETS_FILE"; then rb=1; fi
  if [ -d "$INSTALL_DIR.failed" ]; then log "failed tree kept at $INSTALL_DIR.failed for inspection"; fi
  if [ "$rb" = 1 ]; then
    fail_code 5 "rollback INCOMPLETE after failed upgrade ($why) — inspect $INSTALL_DIR, $SECRETS_FILE, $UNIT_FILE and 'journalctl -u ship-agent' manually"
  fi
  log "rollback verified: previous agent restored (version ${running:-?}${OLD_VERSION:+, expected $OLD_VERSION}, credentials and unit in place)"
  fail_code 4 "upgrade failed and was rolled back: $why"
}

# ---- commit region (M2-R1): swap, dirs, env/unit writes, permissions, service
# start and health ALL route failures into the single rollback above — no step in
# this region may abort via set -e leaving a half-committed machine behind ----
if [ "$HAD_OLD" = 1 ]; then
  mv "$INSTALL_DIR" "$INSTALL_DIR.old" || rollback_and_fail "program swap: moving the previous tree aside failed"
fi
mv "$INSTALL_DIR.new" "$INSTALL_DIR" || rollback_and_fail "program swap: installing the new tree failed"
mkdir -p "$WORK_ROOT" /etc/shipkit || rollback_and_fail "runtime/config directories could not be created"
write_secrets_file || rollback_and_fail "writing $SECRETS_FILE failed"
chmod 600 "$SECRETS_FILE" || rollback_and_fail "chmod 600 $SECRETS_FILE failed"

if [ "${SKIP_SYSTEMD:-0}" = 1 ]; then
  log "SKIP_SYSTEMD=1: starting without systemd (test mode; log: /var/log/ship-agent.log)"
  start_without_systemd || rollback_and_fail "starting the agent without systemd failed"
else
  write_unit_file || rollback_and_fail "writing $UNIT_FILE failed"
  if ! systemctl daemon-reload; then rollback_and_fail "systemctl daemon-reload failed"; fi
  if ! systemctl enable ship-agent; then rollback_and_fail "systemctl enable ship-agent failed"; fi
  if ! systemctl restart ship-agent; then rollback_and_fail "systemctl restart ship-agent failed"; fi
fi

# ---- wait for health; a version mismatch is a failed install (UX05) ----
for _ in $(seq 1 60); do
  BODY="$(health_body "$AGENT_PORT")"
  if [ -n "$BODY" ]; then
    RUNNING_VERSION="$(health_version "$BODY")"
    if [ -n "$BUNDLE_VERSION" ] && [ "$RUNNING_VERSION" != "$BUNDLE_VERSION" ]; then
      rollback_and_fail "agent reports version ${RUNNING_VERSION}, bundle is ${BUNDLE_VERSION}"
    fi
    log "ship-agent healthy on port ${AGENT_PORT} (role=${ROLE}, version=${RUNNING_VERSION})"
    log "pairing hint: node ${INSTALL_DIR}/agent/server.js --pair --role <builder|runtime> mints a one-time code for \`ship pair\`"
    cleanup_upgrade_artifacts
    exit 0
  fi
  sleep 2
done
if [ "${SKIP_SYSTEMD:-0}" = 0 ]; then journalctl -u ship-agent --no-pager -n 30 || true; else tail -30 /var/log/ship-agent.log || true; fi
rollback_and_fail "agent did not become healthy within 120s"
