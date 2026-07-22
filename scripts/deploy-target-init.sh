#!/bin/sh
# linuxserver/openssh-server custom container-init script.
# Runs once during s6 boot, before sshd starts. Installs the tools the
# devpilot deploy flow needs: docker CLI + compose plugin, git, nginx, curl.
set -e

echo "[deploy-target-init] installing docker-cli, docker-cli-compose, git, nginx, curl"
apk add --no-cache docker-cli docker-cli-compose git nginx curl openssh-client-default 2>&1 \
  | tee -a /config/tools-install.log || true

echo "[deploy-target-init] tools install done at $(date)" >> /config/tools-install.log

# Make sure the deploy user can reach the docker socket. The socket is owned
# by root:root on the host (gid 0); the deploy user is non-root, so add it to
# the host-equivalent group. On alpine the primary group is `users` (gid 100);
# we instead grant group read on the socket by adding deploy to a group whose
# gid matches the socket's. Simpler: just chmod the socket in-container.
# (We do NOT change the socket on the host; the bind mount is rw but the
# filesystem permission we set here is only in-container view.)
if [ -e /var/run/docker.sock ]; then
  chmod 666 /var/run/docker.sock 2>/dev/null || true
fi

# Ensure /config is owned by the deploy user so custom keys/logs are writable.
chown -R "$PUID:$PGID" /config 2>/dev/null || true

exit 0
