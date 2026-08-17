#!/bin/sh
set -eu

: "${RELEASE_BUILD_WORKER_INPUT_ROOT:?required}"
: "${RELEASE_BUILD_WORKER_OUTPUT_ROOT:?required}"
: "${RELEASE_BUILD_WORK_ROOT:?required}"
: "${RELEASE_BUILD_WORKER_HMAC_SECRET_FILE:?required}"
: "${RELEASE_BUILD_LAUNCHER_PROOF_FILE:?required}"
: "${RELEASE_BUILD_LAUNCHER_JOB_IMAGE:?required}"
: "${RELEASE_BUILD_LAUNCHER_INSTANCE_LABEL:?required}"
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

for directory in "$RELEASE_BUILD_WORKER_INPUT_ROOT" \
  "$RELEASE_BUILD_WORKER_OUTPUT_ROOT" "$RELEASE_BUILD_WORK_ROOT"; do
  [ -d "$directory" ] || { echo "pre-provisioned directory missing: $directory" >&2; exit 1; }
done
for file in "$RELEASE_BUILD_WORKER_HMAC_SECRET_FILE" \
  "$RELEASE_BUILD_LAUNCHER_PROOF_FILE" "$RELEASE_BUILD_SUPPLY_PROOF_FILE"; do
  [ -f "$file" ] || { echo "pre-provisioned file missing: $file" >&2; exit 1; }
done

export RELEASE_BUILD_LAUNCHER_DOCKER_EXECUTABLE="${RELEASE_BUILD_LAUNCHER_DOCKER_EXECUTABLE:-/usr/bin/docker}"
export RELEASE_BUILD_COMMAND_PATH="${RELEASE_BUILD_COMMAND_PATH:-/usr/local/bin:/usr/bin:/bin}"
export RELEASE_BUILD_COMMAND_TIMEOUT_MS="${RELEASE_BUILD_COMMAND_TIMEOUT_MS:-120000}"
export RELEASE_BUILD_CANCEL_GRACE_MS="${RELEASE_BUILD_CANCEL_GRACE_MS:-5000}"

exec node apps/devpilot-api/dist/release-delivery/release-build-filesystem-worker.main.js
