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
