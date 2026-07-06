import { CommandRule } from "./server-command-policy.types";

export const OPENRESTY_COMMAND_RULES: CommandRule[] = [
  {
    key: "openresty-baseline-stub-status",
    description: "Check stub_status module baseline",
    adapters: ["nginx-site-plan"],
    operations: ["site.openresty_module_baseline"],
    pattern:
      /^\(nginx -V 2>&1 \|\| true; openresty -V 2>&1 \|\| true\) \| grep -Eq -- '--with-http_stub_status_module' && echo 'present: stub_status' \|\| echo 'missing: stub_status'$/,
  },
  {
    key: "openresty-baseline-stream",
    description: "Check stream module baseline",
    adapters: ["nginx-site-plan"],
    operations: ["site.openresty_module_baseline"],
    pattern:
      /^\(nginx -V 2>&1 \|\| true; openresty -V 2>&1 \|\| true\) \| grep -Eq -- '--with-stream' && echo 'present: stream' \|\| echo 'missing: stream'$/,
  },
  {
    key: "openresty-baseline-lua",
    description: "Check Lua/OpenResty module baseline",
    adapters: ["nginx-site-plan"],
    operations: ["site.openresty_module_baseline"],
    pattern:
      /^\(nginx -V 2>&1 \|\| true; openresty -V 2>&1 \|\| true; find \/etc\/nginx\/modules-enabled \/usr\/lib\/nginx\/modules \/usr\/local\/openresty\/nginx\/modules -maxdepth 1 -type f -name '\*\.so' -print 2>\/dev\/null \|\| true\) \| grep -Eiq 'http_lua\|lua-nginx\|ngx_http_lua\|lua\.\*\\\.so' && echo 'present: lua' \|\| echo 'missing: lua'$/,
  },
  {
    key: "nginx-test",
    description: "Validate Nginx config",
    adapters: ["nginx-site-plan"],
    pattern: /^nginx -t$/,
  },
  {
    key: "nginx-reload",
    description: "Reload Nginx",
    adapters: ["nginx-site-plan"],
    pattern: /^systemctl reload nginx \|\| nginx -s reload$/,
  },
  {
    key: "tail-nginx-log",
    description: "Tail Nginx log file",
    adapters: ["log-collection-plan", "nginx-site-plan"],
    pattern: /^tail -n \d{1,5} \/var\/log\/nginx\/(access|error)\.log$/,
  },
  {
    key: "tail-nginx-log-optional",
    description:
      "Tail Nginx log file without failing diagnostics when the file is absent",
    adapters: ["nginx-site-plan"],
    pattern:
      /^tail -n \d{1,5} \/var\/log\/nginx\/(access|error)\.log \|\| true$/,
  },
  {
    key: "tail-var-log",
    description: "Tail a log file under /var/log",
    adapters: ["log-collection-plan"],
    pattern: /^tail -n \d{1,5} \/var\/log\/(?!.*\.\.)[a-zA-Z0-9_./@-]+\.log$/,
  },
];
