#!/usr/bin/env bash
# ship-agent installer — run as root on the target machine (Linux, apt/dnf/yum).
# Rendered by the controller's bundle server (__ROLE__/__AGENT_TOKEN__/__AGENT_PORT__/__BUNDLE_BASE__
# are replaced); manual runs may provide the same values via env instead.
# Env overrides: ROLE AGENT_TOKEN AGENT_PORT BUNDLE_BASE WORK_ROOT
#                TARBALL (local agent.tgz, skips the download), SHIP_PUSH_USER/SHIP_PUSH_PASSWORD
set -euo pipefail

ROLE="${ROLE:-__ROLE__}"
AGENT_TOKEN="${AGENT_TOKEN:-__AGENT_TOKEN__}"
AGENT_PORT="${AGENT_PORT:-__AGENT_PORT__}"
AGENT_BIND="${AGENT_BIND:-0.0.0.0}"   # set 127.0.0.1 when fronted by a TLS reverse proxy (F09)
BUNDLE_BASE="${BUNDLE_BASE:-__BUNDLE_BASE__}"
TARBALL="${TARBALL:-}"
WORK_ROOT="${WORK_ROOT:-/opt/shipkit-data}"
INSTALL_DIR=/opt/shipkit

log() { echo "[ship-install] $*"; }

if [ "$(id -u)" != 0 ]; then
  echo "[ship-install] must run as root (cloud-init does; manually: curl ... | sudo bash)" >&2
  exit 1
fi
if [ "$AGENT_TOKEN" = "__AGENT_TOKEN""__" ]; then
  echo "[ship-install] AGENT_TOKEN not set (this installer is meant to be rendered by the controller)" >&2
  exit 1
fi
if [ -z "$TARBALL" ] && [ "$BUNDLE_BASE" = "__BUNDLE_BASE""__" ]; then
  echo "[ship-install] need either TARBALL=<local agent.tgz> or BUNDLE_BASE=<bundle server base url>" >&2
  exit 1
fi

# ---- package manager ----
PKG=""
if command -v apt-get >/dev/null 2>&1; then PKG=apt
elif command -v dnf >/dev/null 2>&1; then PKG=dnf
elif command -v yum >/dev/null 2>&1; then PKG=yum
else echo "[ship-install] unsupported distro (need apt/dnf/yum)" >&2; exit 1
fi
log "package manager: $PKG"

# ---- docker ----
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
docker version >/dev/null 2>&1 || { echo "[ship-install] docker is not usable" >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "[ship-install] docker compose plugin missing" >&2; exit 1; }
log "docker ok: $(docker --version)"

# ---- node >= 20 (mirror adapter: NODE_MIRROR env > Tencent intranet > npmmirror > NodeSource) ----
node_major() { node -e 'process.stdout.write(process.versions.node.split(".")[0])' 2>/dev/null || echo 0; }
install_node() {
  [ "$(node_major)" -ge 20 ] && return 0
  log "installing node 20 (current: $(node --version 2>/dev/null || echo none))"
  local base
  if [ -n "${NODE_MIRROR:-}" ]; then
    base="${NODE_MIRROR%/}"
  elif curl -4 -sf --max-time 6 http://mirrors.tencentyun.com/nodejs-release/ >/dev/null 2>&1; then
    base="http://mirrors.tencentyun.com/nodejs-release"
  else
    base="https://cdn.npmmirror.com/binaries/node"
  fi
  local arch
  arch=$(uname -m)
  case "$arch" in x86_64) arch=x64 ;; aarch64) arch=arm64 ;; esac
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
[ "$(node_major)" -ge 20 ] || { echo "[ship-install] node >=20 required, got $(node --version 2>/dev/null || echo none)" >&2; exit 1; }
log "node ok: $(node --version)"

# ---- agent bundle ----
if [ -n "$TARBALL" ]; then
  log "using local agent tarball: $TARBALL"
  cp "$TARBALL" /tmp/ship-agent.tgz
else
  log "downloading agent bundle from $BUNDLE_BASE"
  curl -fsSL "$BUNDLE_BASE/agent.tgz" -o /tmp/ship-agent.tgz
fi
rm -rf "$INSTALL_DIR.new"
mkdir -p "$INSTALL_DIR.new"
tar -xzf /tmp/ship-agent.tgz -C "$INSTALL_DIR.new"
[ -f "$INSTALL_DIR.new/agent/server.js" ] || { echo "[ship-install] bundle broken: agent/server.js missing" >&2; exit 1; }
rm -rf "$INSTALL_DIR.old"
[ -d "$INSTALL_DIR" ] && mv "$INSTALL_DIR" "$INSTALL_DIR.old"
mv "$INSTALL_DIR.new" "$INSTALL_DIR"
rm -rf "$INSTALL_DIR.old"
log "agent installed at $INSTALL_DIR"

# ---- systemd unit (secrets in a 0600 EnvironmentFile, F10; pull creds too, F21) ----
mkdir -p "$WORK_ROOT" /etc/shipkit
SECRETS_FILE=/etc/shipkit/agent.env
cat > "$SECRETS_FILE" <<EOF
SHIP_AGENT_TOKEN=${AGENT_TOKEN}
SHIP_PUSH_USER=${SHIP_PUSH_USER:-}
SHIP_PUSH_PASSWORD=${SHIP_PUSH_PASSWORD:-}
SHIP_PULL_USER=${SHIP_PULL_USER:-}
SHIP_PULL_PASSWORD=${SHIP_PULL_PASSWORD:-}
EOF
chmod 600 "$SECRETS_FILE"
cat > /etc/systemd/system/ship-agent.service <<EOF
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
systemctl daemon-reload
systemctl enable ship-agent
# re-install must replace a RUNNING agent, not just "enable --now" past it (F22)
systemctl restart ship-agent

# ---- wait for health ----
for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${AGENT_PORT}/health" >/dev/null 2>&1; then
    log "ship-agent healthy on port ${AGENT_PORT} (role=${ROLE})"
    exit 0
  fi
  sleep 2
done
journalctl -u ship-agent --no-pager -n 30 || true
echo "[ship-install] agent did not become healthy within 120s" >&2
exit 1
