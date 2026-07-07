/**
 * Pure Site OpenResty/Nginx inspection execution-plan builders + their warning
 * collectors. Extracted from `SiteService`. All functions are pure.
 */

import { ServerCommandStep } from '../server-executor';
import { type SiteRecordLike, type SiteSyncExecutionPlan } from './site-plan.types';

function collectOpenRestyStatusWarnings(site: SiteRecordLike) {
  const warnings: string[] = [];
  if (!site.serverId) {
    warnings.push('未关联目标服务器，无法通过 Server executor 探测 OpenResty/Nginx 运行态');
  }
  return warnings;
}

function collectOpenRestyModulesWarnings(site: SiteRecordLike) {
  const warnings: string[] = [];
  if (!site.serverId) {
    warnings.push('未关联目标服务器，无法通过 Server executor 盘点 OpenResty/Nginx 模块');
  }
  return warnings;
}

function collectOpenRestyModuleBaselineWarnings(site: SiteRecordLike) {
  const warnings: string[] = [];
  if (!site.serverId) {
    warnings.push('未关联目标服务器，无法通过 Server executor 检查 OpenResty/Nginx 模块基线');
  }
  return warnings;
}

export function buildOpenRestyStatusPlan(site: SiteRecordLike): SiteSyncExecutionPlan {
  const warnings = collectOpenRestyStatusWarnings(site);
  const commandPlan: ServerCommandStep[] = [
    { key: 'nginx_config_test_status', label: '读取 Nginx/OpenResty 配置测试结果', command: 'nginx -t 2>&1 || true', required: false, risk: 'low', timeoutSeconds: 30 },
    { key: 'nginx_build_info', label: '读取 Nginx 构建信息', command: 'nginx -V 2>&1 || true', required: false, risk: 'low', timeoutSeconds: 10 },
    { key: 'openresty_build_info', label: '读取 OpenResty 构建信息', command: 'openresty -V 2>&1 || true', required: false, risk: 'low', timeoutSeconds: 10 },
    { key: 'nginx_service_status', label: '读取 Nginx systemd 活跃状态', command: 'systemctl is-active nginx || true', required: false, risk: 'low', timeoutSeconds: 10 },
    { key: 'openresty_service_status', label: '读取 OpenResty systemd 活跃状态', command: 'systemctl is-active openresty || true', required: false, risk: 'low', timeoutSeconds: 10 },
    { key: 'nginx_openresty_process_status', label: '读取 Nginx/OpenResty 进程摘要', command: "ps -eo pid,comm,args | grep -E 'nginx|openresty' | grep -v grep | head -20 || true", required: false, risk: 'low', timeoutSeconds: 10 },
  ];

  return {
    target: { serverId: site.serverId, serverName: site.server?.name, serverHost: site.server?.host, configPath: `openresty-status://${site.primaryDomain || site.id}`, runtimeType: site.runtimeType },
    commandPlan,
    warnings,
    nginxConfig: '',
  };
}

export function buildOpenRestyModulesPlan(site: SiteRecordLike): SiteSyncExecutionPlan {
  const warnings = collectOpenRestyModulesWarnings(site);
  const commandPlan: ServerCommandStep[] = [
    { key: 'nginx_module_config_args', label: '读取 Nginx 编译模块参数', command: 'nginx -V 2>&1 || true', required: false, risk: 'low', timeoutSeconds: 10 },
    { key: 'openresty_module_config_args', label: '读取 OpenResty 编译模块参数', command: 'openresty -V 2>&1 || true', required: false, risk: 'low', timeoutSeconds: 10 },
    { key: 'nginx_dynamic_module_files', label: '读取 Nginx/OpenResty 动态模块文件', command: "find /etc/nginx/modules-enabled /usr/lib/nginx/modules /usr/local/openresty/nginx/modules -maxdepth 1 -type f -name '*.so' -print 2>/dev/null | sort || true", required: false, risk: 'low', timeoutSeconds: 10 },
  ];

  return {
    target: { serverId: site.serverId, serverName: site.server?.name, serverHost: site.server?.host, configPath: `openresty-modules://${site.primaryDomain || site.id}`, runtimeType: site.runtimeType },
    commandPlan,
    warnings,
    nginxConfig: '',
  };
}

export function buildOpenRestyModuleBaselinePlan(site: SiteRecordLike): SiteSyncExecutionPlan {
  const warnings = collectOpenRestyModuleBaselineWarnings(site);
  const commandPlan: ServerCommandStep[] = [
    { key: 'baseline_tls_module', label: '检查 TLS/SSL 模块能力', command: "(nginx -V 2>&1 || true; openresty -V 2>&1 || true) | grep -Eq -- '--with-http_ssl_module|--with-openssl' && echo 'present: tls' || echo 'missing: tls'", required: false, risk: 'low', timeoutSeconds: 10 },
    { key: 'baseline_http2_module', label: '检查 HTTP/2 或 HTTP/3 模块能力', command: "(nginx -V 2>&1 || true; openresty -V 2>&1 || true) | grep -Eq -- '--with-http_v2_module|--with-http_v3_module' && echo 'present: http2_or_http3' || echo 'missing: http2_or_http3'", required: false, risk: 'low', timeoutSeconds: 10 },
    { key: 'baseline_realip_module', label: '检查真实客户端 IP 模块能力', command: "(nginx -V 2>&1 || true; openresty -V 2>&1 || true) | grep -Eq -- '--with-http_realip_module' && echo 'present: realip' || echo 'missing: realip'", required: false, risk: 'low', timeoutSeconds: 10 },
    { key: 'baseline_stub_status_module', label: '检查 stub_status 状态模块能力', command: "(nginx -V 2>&1 || true; openresty -V 2>&1 || true) | grep -Eq -- '--with-http_stub_status_module' && echo 'present: stub_status' || echo 'missing: stub_status'", required: false, risk: 'low', timeoutSeconds: 10 },
    { key: 'baseline_stream_module', label: '检查 stream 转发模块能力', command: "(nginx -V 2>&1 || true; openresty -V 2>&1 || true) | grep -Eq -- '--with-stream' && echo 'present: stream' || echo 'missing: stream'", required: false, risk: 'low', timeoutSeconds: 10 },
    { key: 'baseline_lua_module', label: '检查 Lua/OpenResty 模块能力', command: "(nginx -V 2>&1 || true; openresty -V 2>&1 || true; find /etc/nginx/modules-enabled /usr/lib/nginx/modules /usr/local/openresty/nginx/modules -maxdepth 1 -type f -name '*.so' -print 2>/dev/null || true) | grep -Eiq 'http_lua|lua-nginx|ngx_http_lua|lua.*\\.so' && echo 'present: lua' || echo 'missing: lua'", required: false, risk: 'low', timeoutSeconds: 10 },
  ];

  return {
    target: { serverId: site.serverId, serverName: site.server?.name, serverHost: site.server?.host, configPath: `openresty-module-baseline://${site.primaryDomain || site.id}`, runtimeType: site.runtimeType },
    commandPlan,
    warnings,
    nginxConfig: '',
  };
}
