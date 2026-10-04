#!/usr/bin/env bash
# Generated distribution file — do not edit bootstrap/install.sh directly.
# Source modules live in bootstrap/src/ (00-params, 10-preflight, 20-packages,
# 30-bundle, 40-transaction) and are concatenated by scripts/build-install.mjs.
#
# ship-agent installer — run as root on the target machine (Linux, apt/dnf/yum).
# Rendered by the controller's bundle server (the __NAME__ sentinels below are
# replaced); manual runs provide the same values via env instead.
#
# Parameter priority (M2-01), later layers only fill still-empty values:
#   1. explicit environment (ROLE=, AGENT_TOKEN=, AGENT_PORT=, AGENT_BIND=, WORK_ROOT=)
#   2. an existing installation (agent.env + systemd unit)
#   3. the controller-rendered template (bundle server substitution)
#   4. built-in defaults
# Sentinel comparisons are built at runtime (printf '__%s__'), so the renderer's
# blanket placeholder replacement can never rewrite them into value comparisons.
#
# Other env: TARBALL (local agent.tgz) TARBALL_SHA256 (trusted hex)
#   SHIP_PUSH_USER/SHIP_PUSH_PASSWORD SHIP_PULL_USER/SHIP_PULL_PASSWORD
#   SKIP_DOCKER=1 SKIP_SYSTEMD=1 (test / air-gapped containers only)
set -euo pipefail

ROLE_TPL='__ROLE__'
AGENT_TOKEN_TPL='__AGENT_TOKEN__'
AGENT_PORT_TPL='__AGENT_PORT__'
BUNDLE_BASE_TPL='__BUNDLE_BASE__'
ROLE="${ROLE:-}"
AGENT_TOKEN="${AGENT_TOKEN:-}"
AGENT_PORT="${AGENT_PORT:-}"
AGENT_BIND="${AGENT_BIND:-}"
WORK_ROOT="${WORK_ROOT:-}"
BUNDLE_BASE="${BUNDLE_BASE:-}"
TARBALL="${TARBALL:-}"
TARBALL_SHA256="${TARBALL_SHA256:-}"
INSTALL_DIR=/opt/shipkit
SECRETS_FILE=/etc/shipkit/agent.env
UNIT_FILE=/etc/systemd/system/ship-agent.service

log() { echo "[ship-install] $*"; }
fail() { echo "[ship-install] $*" >&2; exit 1; }
fail_code() { echo "[ship-install] $2" >&2; exit "$1"; }

# true when the bundle server actually substituted the sentinel (raw script keeps it)
tpl_set() { [ -n "$2" ] && [ "$2" != "$(printf '__%s__' "$1")" ]; }

# ---- layer 2: the live machine's own values win unless explicitly overridden ----
if [ -f "$SECRETS_FILE" ]; then
  pd() { sed -n "s/^$1=//p" "$SECRETS_FILE" | tail -1; }
  AGENT_TOKEN="${AGENT_TOKEN:-$(pd SHIP_AGENT_TOKEN)}"
  SHIP_PUSH_USER="${SHIP_PUSH_USER:-$(pd SHIP_PUSH_USER)}"
  SHIP_PUSH_PASSWORD="${SHIP_PUSH_PASSWORD:-$(pd SHIP_PUSH_PASSWORD)}"
  SHIP_PULL_USER="${SHIP_PULL_USER:-$(pd SHIP_PULL_USER)}"
  SHIP_PULL_PASSWORD="${SHIP_PULL_PASSWORD:-$(pd SHIP_PULL_PASSWORD)}"
  log "existing credentials detected — token/registry creds are preserved (upgrade path)"
fi
if [ -f "$UNIT_FILE" ]; then
  pu() { sed -n "s/^Environment=$1=//p" "$UNIT_FILE" | tail -1; }
  ROLE="${ROLE:-$(pu SHIP_AGENT_ROLE)}"
  AGENT_PORT="${AGENT_PORT:-$(pu SHIP_AGENT_PORT)}"
  AGENT_BIND="${AGENT_BIND:-$(pu SHIP_AGENT_HOST)}"
  WORK_ROOT="${WORK_ROOT:-$(pu SHIP_WORK_ROOT)}"
fi
# ---- layer 3: controller-rendered template ----
tpl_set ROLE "$ROLE_TPL" && ROLE="${ROLE:-$ROLE_TPL}"
tpl_set AGENT_TOKEN "$AGENT_TOKEN_TPL" && AGENT_TOKEN="${AGENT_TOKEN:-$AGENT_TOKEN_TPL}"
tpl_set AGENT_PORT "$AGENT_PORT_TPL" && AGENT_PORT="${AGENT_PORT:-$AGENT_PORT_TPL}"
# ---- layer 4: built-in defaults ----
[ -n "$ROLE" ] || ROLE=both
[ -n "$AGENT_PORT" ] || AGENT_PORT=7410
[ -n "$AGENT_BIND" ] || AGENT_BIND=0.0.0.0
[ -n "$WORK_ROOT" ] || WORK_ROOT=/opt/shipkit-data

# ---- preflight: identity, source, parameters, and pre-swap write conditions ----
# Everything here fails BEFORE any installation state is touched (M2-R1).

[ "$(id -u)" = 0 ] || fail "must run as root (manually: curl ... | sudo bash)"
if [ -z "$TARBALL" ]; then
  if [ -n "$BUNDLE_BASE" ]; then :
  elif tpl_set BUNDLE_BASE "$BUNDLE_BASE_TPL"; then BUNDLE_BASE="$BUNDLE_BASE_TPL"
  else fail "need either TARBALL=<local agent.tgz> or BUNDLE_BASE=<bundle server base url>"; fi
fi

case "$ROLE" in builder | runtime | both) ;; *) fail "ROLE must be builder|runtime|both (got '$ROLE')" ;; esac
case "$AGENT_PORT" in '' | *[!0-9]*) fail "AGENT_PORT must be numeric (got '$AGENT_PORT')" ;; esac
if [ -z "$AGENT_TOKEN" ] || [ "$AGENT_TOKEN" = "$(printf '__%s__' AGENT_TOKEN)" ]; then
  fail "AGENT_TOKEN not set (fresh install: provide it via env or the rendered installer; upgrade: it is read from $SECRETS_FILE)"
fi

# predictable path conflicts: refuse instead of discovering them mid-transaction
if [ -e "$WORK_ROOT" ] && [ ! -d "$WORK_ROOT" ]; then
  fail "WORK_ROOT '$WORK_ROOT' exists and is not a directory — nothing was changed; pick another WORK_ROOT"
fi
if [ -e "$INSTALL_DIR" ] && [ ! -d "$INSTALL_DIR" ]; then
  fail "$INSTALL_DIR exists and is not a directory — nothing was changed; resolve it manually first"
fi
if [ -e "$SECRETS_FILE" ] && [ ! -f "$SECRETS_FILE" ]; then
  fail "$SECRETS_FILE exists and is not a regular file — nothing was changed; resolve it manually first"
fi
if [ "${SKIP_SYSTEMD:-0}" != 1 ] && [ -e "$UNIT_FILE" ] && [ ! -f "$UNIT_FILE" ]; then
  fail "$UNIT_FILE exists and is not a regular file — nothing was changed; resolve it manually first"
fi

# write-condition probe: create the runtime/config dirs now (idempotent) so a
# read-only or blocked path fails before the program tree is swapped
mkdir -p "$WORK_ROOT" /etc/shipkit || fail "cannot create $WORK_ROOT / /etc/shipkit — nothing was changed"
[ -w /etc/shipkit ] || fail "/etc/shipkit is not writable — nothing was changed"
[ -w "$WORK_ROOT" ] || fail "WORK_ROOT '$WORK_ROOT' is not writable — nothing was changed"
if [ "${SKIP_SYSTEMD:-0}" != 1 ]; then
  [ -w /etc/systemd/system ] || fail "/etc/systemd/system is not writable — nothing was changed"
fi

# ---- package manager ----
PKG=""
if command -v apt-get >/dev/null 2>&1; then PKG=apt
elif command -v dnf >/dev/null 2>&1; then PKG=dnf
elif command -v yum >/dev/null 2>&1; then PKG=yum
else fail "unsupported distro (need apt/dnf/yum)"
fi
log "package manager: $PKG"

# ---- docker ----
if [ "${SKIP_DOCKER:-0}" = 1 ]; then
  log "SKIP_DOCKER=1: skipping docker install/checks (test or air-gapped mode; agent will report docker:false and refuse jobs)"
else
  install_docker() {
    command -v docker >/dev/null 2>&1 && return 0
    if [ "$PKG" = apt ] && curl -4 -sf --max-time 6 http://mirrors.tencentyun.com/docker-ce/linux/ubuntu/dists/ >/dev/null 2>&1; then
      log "installing docker from Tencent intranet mirror"
      apt-get update -qq
      apt-get install -y -qq ca-certificates curl gnupg >/dev/null
      install -m 0755 -d /etc/apt/keyrings
      curl -fsSL http://mirrors.tencentyun.com/docker-ce/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
      chmod a+r /etc/apt/keyrings/docker.asc
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] http://mirrors.tencentyun.com/docker-ce/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
      apt-get update -qq
      apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    else
      log "installing docker via get.docker.com"
      curl -fsSL https://get.docker.com | sh
    fi
  }
  install_docker
  systemctl enable --now docker >/dev/null 2>&1 || true
  docker version >/dev/null 2>&1 || fail "docker is not usable"
  docker compose version >/dev/null 2>&1 || fail "docker compose plugin missing"
  log "docker ok: $(docker --version)"
fi

# ---- node >= 20 (mirror adapter: NODE_MIRROR env > Tencent intranet > npmmirror > NodeSource) ----
node_major() { node -e 'process.stdout.write(process.versions.node.split(".")[0])' 2>/dev/null || echo 0; }
install_node() {
  [ "$(node_major)" -ge 20 ] && return 0
  log "installing node 20 (current: $(node --version 2>/dev/null || echo none))"
  local base
  if [ -n "${NODE_MIRROR:-}" ]; then base="${NODE_MIRROR%/}"
  elif curl -4 -sf --max-time 6 http://mirrors.tencentyun.com/nodejs-release/ >/dev/null 2>&1; then base="http://mirrors.tencentyun.com/nodejs-release"
  else base="https://cdn.npmmirror.com/binaries/node"
  fi
  local arch; arch=$(uname -m); case "$arch" in x86_64) arch=x64 ;; aarch64) arch=arm64 ;; esac
  if curl -4 -fsSL --retry 3 --max-time 600 "$base/v20.18.1/node-v20.18.1-linux-${arch}.tar.gz" -o /tmp/node.tar.gz; then
    log "node tarball from $base"
    tar -xzf /tmp/node.tar.gz -C /usr/local --strip-components=1
    rm -f /tmp/node.tar.gz
  else
    log "node mirror failed; falling back to NodeSource"
    case "$PKG" in
      apt) curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs ;;
      dnf | yum) curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - && "$PKG" install -y nodejs ;;
    esac
  fi
}
install_node
[ "$(node_major)" -ge 20 ] || fail "node >=20 required, got $(node --version 2>/dev/null || echo none)"
log "node ok: $(node --version)"

# ---- agent bundle + integrity (UX05, M2-09) ----
# per-install temp: no fixed shared checksum/tarball paths across installs
TGZ="$(mktemp /tmp/ship-agent.XXXXXX.tgz)"
cleanup_tmp() { rm -f "$TGZ"; }
trap cleanup_tmp EXIT

EXPLICIT_SHA=""
if [ -n "$TARBALL_SHA256" ]; then
  EXPLICIT_SHA=$(printf '%s' "$TARBALL_SHA256" | tr 'A-F' 'a-f')
  printf '%s' "$EXPLICIT_SHA" | grep -Eq '^[0-9a-f]{64}$' || fail "TARBALL_SHA256 must be exactly 64 hex characters (got '$TARBALL_SHA256')"
fi
SIDECAR_SHA=""
if [ -n "$TARBALL" ]; then
  log "using local agent tarball: $TARBALL"
  cp "$TARBALL" "$TGZ"
  if [ -f "${TARBALL}.sha256" ]; then
    read -r want _ < "${TARBALL}.sha256" || want=""
    SIDECAR_SHA=$(printf '%s' "$want" | tr 'A-F' 'a-f')
  fi
else
  log "downloading agent bundle from $BUNDLE_BASE"
  curl -fsSL "$BUNDLE_BASE/agent.tgz" -o "$TGZ"
  SUMS="$(mktemp /tmp/ship-sums.XXXXXX)"
  if curl -fsSL "$BUNDLE_BASE/SHA256SUMS" -o "$SUMS" 2>/dev/null; then
    SIDECAR_SHA=$(printf '%s' "$(grep ' agent.tgz$' "$SUMS" | head -1 | awk '{print $1}')" | tr 'A-F' 'a-f')
  fi
  rm -f "$SUMS"
fi

if [ -n "$EXPLICIT_SHA" ] && [ -n "$SIDECAR_SHA" ] && [ "$EXPLICIT_SHA" != "$SIDECAR_SHA" ]; then
  fail_code 3 "integrity source conflict: explicit TARBALL_SHA256=$EXPLICIT_SHA but the adjacent sidecar says $SIDECAR_SHA — refusing to install (decide which source is trusted)"
fi
WANT_SHA="${EXPLICIT_SHA:-$SIDECAR_SHA}"
if [ -n "$WANT_SHA" ]; then
  ACTUAL_SHA="$(sha256sum "$TGZ" | awk '{print $1}')"
  if [ "$ACTUAL_SHA" != "$WANT_SHA" ]; then
    fail_code 3 "integrity check FAILED for the agent bundle (want $WANT_SHA, got $ACTUAL_SHA) — refusing to install (re-download or re-transfer)"
  fi
  log "bundle sha256 verified (${#WANT_SHA} hex, source: $([ -n "$EXPLICIT_SHA" ] && echo explicit || echo sidecar))"
else
  log "WARNING: no checksum source provided — skipping integrity verification (prefer a SHA256SUMS distribution)"
fi

rm -rf "$INSTALL_DIR.new"
mkdir -p "$INSTALL_DIR.new"
tar -xzf "$TGZ" -C "$INSTALL_DIR.new"
[ -f "$INSTALL_DIR.new/agent/server.js" ] || fail "bundle broken: agent/server.js missing"
BUNDLE_VERSION=""
if [ -f "$INSTALL_DIR.new/VERSION" ]; then BUNDLE_VERSION=$(cat "$INSTALL_DIR.new/VERSION"); fi
log "agent staged at $INSTALL_DIR.new${BUNDLE_VERSION:+ (version $BUNDLE_VERSION)}"

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
