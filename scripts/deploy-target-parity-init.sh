#!/bin/sh
# linuxserver/openssh-server custom container-init script for the parity
# deploy target. Runs once during s6 boot, before sshd starts. Installs the
# tools the devpilot deploy flow needs: docker CLI + compose plugin, git,
# nginx, curl. Unlike scripts/deploy-target-init.sh, this parity variant does
# NOT touch /var/run/docker.sock (the parity stack never mounts the host
# socket) and does not bind the picshare checkout.
set -e

echo "[deploy-target-parity-init] installing docker-cli, docker-cli-compose, git, nginx, curl"
apk add --no-cache docker-cli docker-cli-compose git nginx curl openssh-client-default 2>&1 \
  | tee -a /config/tools-install.log || true

echo "[deploy-target-parity-init] tools install done at $(date)" >> /config/tools-install.log

# devpilot site-sync infra: let the non-root deploy user manage nginx.
# 1. conf.d include inside the http block (Alpine's stock nginx.conf includes
#    /etc/nginx/conf.d/*.conf at the ROOT context; server{} is invalid there).
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

# 5. Ensure /config is owned by the deploy user so custom keys/logs are writable.
chown -R "$PUID:$PGID" /config 2>/dev/null || true

# 6. Start nginx master now (port 80) so `nginx -s reload` works later.
nginx 2>/dev/null || true

echo "[deploy-target-parity-init] parity target ready" >> /config/tools-install.log
exit 0
