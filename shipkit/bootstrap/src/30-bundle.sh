
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
