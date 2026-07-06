import { CommandRule } from "./server-command-policy.types";

export const SITE_COMMAND_RULES: CommandRule[] = [
  {
    key: "site-public-smoke-check",
    description: "Site public domain smoke check",
    adapters: ["nginx-site-plan"],
    operations: ["site.smoke_check"],
    pattern:
      /^curl -fsS https?:\/\/[a-zA-Z0-9.-]+(?:\/[a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=%-]*)?$/,
  },
  {
    key: "site-local-host-smoke-check",
    description: "Site local Nginx host routing smoke check",
    adapters: ["nginx-site-plan"],
    operations: ["site.smoke_check"],
    pattern:
      /^curl -fsS -H 'Host: [a-zA-Z0-9.-]+' http:\/\/127\.0\.0\.1(?::\d{1,5})?\/?$/,
  },
  {
    key: "nginx-config-heredoc",
    description: "Write generated Nginx site config",
    adapters: ["nginx-site-plan"],
    pattern:
      /^cat > \/etc\/nginx\/conf\.d\/[a-z0-9.-]+\.conf <<'EOF'\n[\s\S]+\nEOF$/,
  },
  {
    key: "certbot-nginx",
    description: "Issue Let’s Encrypt certificate with certbot nginx plugin",
    adapters: ["nginx-site-plan"],
    pattern:
      /^certbot --nginx (?:-d [a-zA-Z0-9.-]+ ?)+--email [^\s@]+@[^\s@]+\.[^\s@]+ --agree-tos --non-interactive$/,
  },
  {
    key: "openssl-site-tls-probe",
    description: "Probe site TLS certificate metadata with OpenSSL",
    adapters: ["nginx-site-plan"],
    operations: ["site.tls_probe"],
    pattern:
      /^echo \| openssl s_client -servername [a-zA-Z0-9.-]+ -connect [a-zA-Z0-9.-]+:443 2>\/dev\/null \| openssl x509 -noout -subject -issuer -serial -dates -fingerprint -sha256$/,
  },
  {
    key: "certbot-renew-dry-run",
    description: "Dry-run renew Let’s Encrypt certificate by cert name",
    adapters: ["nginx-site-plan"],
    operations: ["site.tls_renew"],
    pattern:
      /^certbot renew --cert-name [a-zA-Z0-9.-]+ --dry-run --non-interactive$/,
  },
  {
    key: "certbot-renew",
    description: "Renew Let’s Encrypt certificate by cert name",
    adapters: ["nginx-site-plan"],
    operations: ["site.tls_renew"],
    pattern: /^certbot renew --cert-name [a-zA-Z0-9.-]+ --non-interactive$/,
  },
  {
    key: "nginx-config-test-status",
    description:
      "Read Nginx config test status without failing the status probe",
    adapters: ["nginx-site-plan"],
    operations: ["site.openresty_status"],
    pattern: /^nginx -t 2>&1 \|\| true$/,
  },
  {
    key: "nginx-version-status",
    description: "Read Nginx build information",
    adapters: ["nginx-site-plan"],
    operations: ["site.openresty_status"],
    pattern: /^nginx -V 2>&1 \|\| true$/,
  },
  {
    key: "openresty-version-status",
    description: "Read OpenResty build information",
    adapters: ["nginx-site-plan"],
    operations: ["site.openresty_status"],
    pattern: /^openresty -V 2>&1 \|\| true$/,
  },
  {
    key: "nginx-service-active-status",
    description: "Read Nginx systemd active status",
    adapters: ["nginx-site-plan"],
    operations: ["site.openresty_status"],
    pattern: /^systemctl is-active nginx \|\| true$/,
  },
  {
    key: "openresty-service-active-status",
    description: "Read OpenResty systemd active status",
    adapters: ["nginx-site-plan"],
    operations: ["site.openresty_status"],
    pattern: /^systemctl is-active openresty \|\| true$/,
  },
  {
    key: "nginx-openresty-process-status",
    description: "Read Nginx/OpenResty process status summary",
    adapters: ["nginx-site-plan"],
    operations: ["site.openresty_status"],
    pattern:
      /^ps -eo pid,comm,args \| grep -E 'nginx\|openresty' \| grep -v grep \| head -20 \|\| true$/,
  },
  {
    key: "nginx-module-config-args",
    description: "Read Nginx compiled module configure arguments",
    adapters: ["nginx-site-plan"],
    operations: ["site.openresty_modules"],
    pattern: /^nginx -V 2>&1 \|\| true$/,
  },
  {
    key: "openresty-module-config-args",
    description: "Read OpenResty compiled module configure arguments",
    adapters: ["nginx-site-plan"],
    operations: ["site.openresty_modules"],
    pattern: /^openresty -V 2>&1 \|\| true$/,
  },
  {
    key: "nginx-dynamic-module-files",
    description:
      "Read Nginx/OpenResty dynamic module files from fixed module directories",
    adapters: ["nginx-site-plan"],
    operations: ["site.openresty_modules"],
    pattern:
      /^find \/etc\/nginx\/modules-enabled \/usr\/lib\/nginx\/modules \/usr\/local\/openresty\/nginx\/modules -maxdepth 1 -type f -name '\*\.so' -print 2>\/dev\/null \| sort \|\| true$/,
  },
  {
    key: "openresty-baseline-tls",
    description: "Check TLS/SSL module baseline",
    adapters: ["nginx-site-plan"],
    operations: ["site.openresty_module_baseline"],
    pattern:
      /^\(nginx -V 2>&1 \|\| true; openresty -V 2>&1 \|\| true\) \| grep -Eq -- '--with-http_ssl_module\|--with-openssl' && echo 'present: tls' \|\| echo 'missing: tls'$/,
  },
  {
    key: "openresty-baseline-http2",
    description: "Check HTTP/2 or HTTP/3 module baseline",
    adapters: ["nginx-site-plan"],
    operations: ["site.openresty_module_baseline"],
    pattern:
      /^\(nginx -V 2>&1 \|\| true; openresty -V 2>&1 \|\| true\) \| grep -Eq -- '--with-http_v2_module\|--with-http_v3_module' && echo 'present: http2_or_http3' \|\| echo 'missing: http2_or_http3'$/,
  },
  {
    key: "openresty-baseline-realip",
    description: "Check real IP module baseline",
    adapters: ["nginx-site-plan"],
    operations: ["site.openresty_module_baseline"],
    pattern:
      /^\(nginx -V 2>&1 \|\| true; openresty -V 2>&1 \|\| true\) \| grep -Eq -- '--with-http_realip_module' && echo 'present: realip' \|\| echo 'missing: realip'$/,
  },
];
