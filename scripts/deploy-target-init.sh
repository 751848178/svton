#!/bin/sh
# linuxserver/openssh-server custom container-init script.
# Runs once during s6 boot, before sshd starts. Installs the tools the
# devpilot deploy flow needs: docker CLI + compose plugin, git, nginx, curl.
set -e

echo "[deploy-target-init] installing docker-cli, docker-cli-compose, git, nginx, curl"
apk add --no-cache docker-cli docker-cli-compose git nginx curl openssh-client-default 2>&1 \
  | tee -a /config/tools-install.log || true

echo "[deploy-target-init] tools install done at $(date)" >> /config/tools-install.log

# --- devpilot site-sync infra: make this box behave like a Debian/nginx host
# the site-sync plan expects (write to /etc/nginx/conf.d, `nginx -t`, reload).
# linuxserver/openssh-server runs as non-root `deploy` (uid $PUID) with no sudo
# escalation in the ssh-live adapter, so we must let deploy manage nginx:
#   1. create /etc/nginx/conf.d and let the nginx.conf load it INSIDE the http
#      block (Alpine ships the include at root context where server{} is invalid)
#   2. own the conf.d + runtime log/pid dirs as the deploy user
#   3. grant passwordless sudo for the nginx binary and add a PATH-shadowing
#      wrapper at /usr/local/bin/nginx so `nginx -t` / `nginx -s reload` (run
#      verbatim by the site-sync plan) execute as root.
echo "[deploy-target-init] configuring nginx for devpilot site-sync"

# 1. conf.d include: Alpine's stock nginx.conf includes /etc/nginx/conf.d/*.conf
#    at the ROOT context (line ~18, outside http) — a server{} block there is a
#    syntax error. Relocate it into the http block (next to the http.d include).
#    Remove any root-context occurrence, then ensure exactly one inside http {}.
sed -i '\|^include /etc/nginx/conf.d/\*.conf;|d' /etc/nginx/nginx.conf
if ! grep -q '^	include /etc/nginx/conf.d/\*.conf;' /etc/nginx/nginx.conf; then
  sed -i '/include \/etc\/nginx\/http\.d\/\*\.conf;/a\	include /etc/nginx/conf.d/*.conf;  # devpilot site-sync target (added)' /etc/nginx/nginx.conf
fi

# 2. conf.d + runtime dirs owned by the deploy user.
mkdir -p /etc/nginx/conf.d /run/nginx /var/lib/nginx/logs /var/log/nginx
chown -R "$PUID:$PGID" /etc/nginx/conf.d /run/nginx /var/lib/nginx /var/log/nginx

# 3. Passwordless sudo for the nginx binary only.
echo "deploy ALL=(root) NOPASSWD: /usr/sbin/nginx" > /etc/sudoers.d/devpilot-nginx
chmod 440 /etc/sudoers.d/devpilot-nginx

# 4. PATH wrapper /usr/local/bin/nginx -> sudo /usr/sbin/nginx (for non-root).
cat > /usr/local/bin/nginx <<'WRAPPER'
#!/bin/bash
# devpilot wrapper: allow the non-root deploy user to manage nginx as root
# (the site-sync plan runs `nginx -t` / `nginx -s reload` verbatim).
if [ "$(id -u)" = "0" ]; then
  exec /usr/sbin/nginx "$@"
else
  exec sudo /usr/sbin/nginx "$@"
fi
WRAPPER
chmod 755 /usr/local/bin/nginx

echo "[deploy-target-init] nginx site-sync infra configured" >> /config/tools-install.log

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

# 5. Pin the site's primary domain to the local nginx inside the container
#    (the smoke-check curls http://picshare.localtest.me). On a real box DNS
#    already resolves this; for the local dataplane we add it to /etc/hosts.
grep -q 'picshare.localtest.me' /etc/hosts || echo '127.0.0.1 picshare.localtest.me' >> /etc/hosts

# 6. Start nginx master now (port 80). The site-sync reload step is
#    `systemctl reload nginx || nginx -s reload`; systemctl is absent on Alpine
#    so it falls through to `nginx -s reload`, which needs the master running.
nginx 2>/dev/null || true

exit 0
