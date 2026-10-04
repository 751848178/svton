
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
