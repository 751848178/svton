#!/bin/sh
set -eu

: "${RELEASE_BUILD_WORKER_INPUT_ROOT:?required}"
: "${RELEASE_BUILD_WORKER_OUTPUT_ROOT:?required}"
: "${RELEASE_BUILD_WORK_ROOT:?required}"
: "${RELEASE_BUILD_WORKER_HMAC_SECRET_FILE:?required}"
: "${RELEASE_BUILD_LAUNCHER_PROOF_FILE:?required}"
: "${RELEASE_BUILD_LAUNCHER_JOB_IMAGE:?required}"
: "${RELEASE_BUILD_SUPPLY_PROOF_FILE:?required}"

if [ "$(id -u)" -ne 0 ]; then
  echo "external OCI release-build launcher must run as root" >&2
  exit 1
fi

case "${RELEASE_BUILD_LAUNCHER_DOCKER_EXECUTABLE:-/usr/bin/docker}" in
  /usr/bin/docker|/usr/local/bin/docker|/opt/homebrew/bin/docker) ;;
  *) echo "docker executable is not registered" >&2; exit 1 ;;
esac

case "$RELEASE_BUILD_LAUNCHER_JOB_IMAGE" in
  *@sha256:????????????????????????????????????????????????????????????????) ;;
  *) echo "job image must use an exact sha256 digest" >&2; exit 1 ;;
esac

install -d -m 0750 -o 2000 -g 2000 \
  "$RELEASE_BUILD_WORKER_INPUT_ROOT" "$RELEASE_BUILD_WORKER_OUTPUT_ROOT"
install -d -m 0700 -o 0 -g 0 "$RELEASE_BUILD_WORK_ROOT" \
  "$(dirname "$RELEASE_BUILD_LAUNCHER_PROOF_FILE")"

export RELEASE_BUILD_LAUNCHER_DOCKER_EXECUTABLE="${RELEASE_BUILD_LAUNCHER_DOCKER_EXECUTABLE:-/usr/bin/docker}"
export RELEASE_BUILD_COMMAND_PATH="${RELEASE_BUILD_COMMAND_PATH:-/usr/local/bin:/usr/bin:/bin}"
export RELEASE_BUILD_COMMAND_TIMEOUT_MS="${RELEASE_BUILD_COMMAND_TIMEOUT_MS:-120000}"
export RELEASE_BUILD_CANCEL_GRACE_MS="${RELEASE_BUILD_CANCEL_GRACE_MS:-5000}"

exec node apps/devpilot-api/dist/release-delivery/release-build-filesystem-worker.main.js
