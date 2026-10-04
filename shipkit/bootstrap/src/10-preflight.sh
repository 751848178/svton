
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
