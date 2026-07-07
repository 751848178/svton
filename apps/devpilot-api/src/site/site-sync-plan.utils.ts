/**
 * Pure Site sync/rollback/diagnostics execution-plan builders + the shared
 * sync-warning collector. Extracted from `SiteService` so the god service stays
 * focused on orchestration. All functions are pure; they delegate Nginx/cert
 * generation to `site-config-gen.utils`.
 */

import { ServerCommandStep } from '../server-executor';
import {
  buildCertificateCommand,
  filenameForDomain,
  generateNginxConfig,
  isSafeDomain,
  isSafeNginxPath,
  isSafeNginxSiteConfigPath,
  isSafeUpstream,
  resolveUpstream,
} from './site-config-gen.utils';
import {
  isRecord,
  readBoolean,
  readString,
  readStringArray,
  type JsonRecord,
  type SiteRecordLike,
  type SiteSyncExecutionPlan,
  type SiteRuntimeType,
} from './site-plan.types';

export function normalizeTailLines(value?: number) {
  if (!Number.isFinite(value)) {
    return 200;
  }
  return Math.max(10, Math.min(Math.floor(value || 200), 1000));
}

export function collectWarnings(
  site: SiteRecordLike,
  runtimeConfig: JsonRecord,
  tls: JsonRecord,
) {
  const warnings: string[] = [];

  if (readBoolean(runtimeConfig.syncBlocked) === true) {
    warnings.push(
      readString(runtimeConfig.syncBlockedReason) ||
      '当前站点被标记为占位配置，需要补齐真实运行时和域名策略后才能同步',
    );
  }

  if (!site.serverId) {
    warnings.push('未关联目标服务器，无法生成可执行的 server-executor 计划');
  }
  if (!site.primaryDomain) {
    warnings.push('未配置主域名');
  } else if (!isSafeDomain(site.primaryDomain)) {
    warnings.push('主域名包含不安全字符，无法写入 Nginx 配置');
  }

  for (const alias of readStringArray(site.aliases)) {
    if (!isSafeDomain(alias)) {
      warnings.push(`域名别名 ${alias} 包含不安全字符，无法写入 Nginx 配置`);
    }
  }

  if (site.runtimeType === 'static') {
    const rootPath = readString(runtimeConfig.rootPath);
    if (!rootPath) {
      warnings.push('静态站点未配置 rootPath');
    } else if (!isSafeNginxPath(rootPath)) {
      warnings.push('静态站点 rootPath 必须是安全的绝对路径');
    }
  } else {
    const upstream = resolveUpstream(site.runtimeType as SiteRuntimeType, runtimeConfig);
    if (!upstream) {
      warnings.push('反向代理/运行时站点未配置 upstreamUrl 或 host/port');
    } else if (!isSafeUpstream(upstream)) {
      warnings.push('上游地址必须是安全的 http/https upstream，且不能包含空白或 shell/nginx 注入字符');
    }
  }

  if (readBoolean(tls.enabled) === true && readString(tls.type) === 'letsencrypt' && !readString(tls.email)) {
    warnings.push('Let’s Encrypt 未配置 email，证书签发命令需要补齐联系人邮箱');
  }

  return warnings;
}

export function buildSyncPlan(site: SiteRecordLike): SiteSyncExecutionPlan {
  const runtimeConfig = isRecord(site.runtimeConfig) ? site.runtimeConfig : {};
  const tls = isRecord(site.tls) ? site.tls : {};
  const accessPolicy = isRecord(site.accessPolicy) ? site.accessPolicy : {};
  const aliases = readStringArray(site.aliases);
  const serverNames = [site.primaryDomain, ...aliases].filter(Boolean);
  const nginxConfig = generateNginxConfig(
    site.runtimeType as SiteRuntimeType,
    site.primaryDomain,
    serverNames,
    runtimeConfig,
    tls,
    accessPolicy,
  );
  const configPath = `/etc/nginx/conf.d/${filenameForDomain(site.primaryDomain)}.conf`;
  const warnings = collectWarnings(site, runtimeConfig, tls);
  const commandPlan: ServerCommandStep[] = [
    { key: 'write_nginx_config', label: '写入 Nginx 站点配置', command: `cat > ${configPath} <<'EOF'\n${nginxConfig}\nEOF`, preview: configPath, required: true, risk: 'medium', timeoutSeconds: 30 },
    { key: 'issue_certificate', label: '签发或续期证书', command: buildCertificateCommand(serverNames, tls), required: readBoolean(tls.enabled) === true && readString(tls.type) === 'letsencrypt', risk: 'medium', timeoutSeconds: 180 },
    { key: 'validate_nginx', label: '校验 Nginx 配置', command: 'nginx -t', required: true, risk: 'low', timeoutSeconds: 30 },
    { key: 'reload_nginx', label: '重载 Nginx', command: 'systemctl reload nginx || nginx -s reload', required: true, risk: 'medium', timeoutSeconds: 30 },
  ];

  return {
    target: { serverId: site.serverId, serverName: site.server?.name, serverHost: site.server?.host, configPath, runtimeType: site.runtimeType },
    warnings,
    commandPlan,
    nginxConfig,
  };
}

export function buildRollbackPlan(
  site: SiteRecordLike,
  nginxConfig: string,
  targetConfigPath?: string | null,
): SiteSyncExecutionPlan {
  const fallbackConfigPath = `/etc/nginx/conf.d/${filenameForDomain(site.primaryDomain)}.conf`;
  const configPath = targetConfigPath && isSafeNginxSiteConfigPath(targetConfigPath)
    ? targetConfigPath
    : fallbackConfigPath;
  const warnings: string[] = [];

  if (!site.serverId) {
    warnings.push('未关联目标服务器，无法生成可执行的 server-executor 回滚计划');
  }
  if (targetConfigPath && targetConfigPath !== configPath) {
    warnings.push('历史同步记录中的配置路径不安全，已回退到当前站点默认 Nginx 配置路径');
  }

  const commandPlan: ServerCommandStep[] = [
    { key: 'write_nginx_config', label: '写回历史 Nginx 站点配置', command: `cat > ${configPath} <<'EOF'\n${nginxConfig}\nEOF`, preview: configPath, required: true, risk: 'medium', timeoutSeconds: 30 },
    { key: 'validate_nginx', label: '校验 Nginx 配置', command: 'nginx -t', required: true, risk: 'low', timeoutSeconds: 30 },
    { key: 'reload_nginx', label: '重载 Nginx', command: 'systemctl reload nginx || nginx -s reload', required: true, risk: 'medium', timeoutSeconds: 30 },
  ];

  return {
    target: { serverId: site.serverId, serverName: site.server?.name, serverHost: site.server?.host, configPath, runtimeType: site.runtimeType },
    warnings,
    commandPlan,
    nginxConfig,
  };
}

export function buildDiagnosticsPlan(site: SiteRecordLike, tailLines?: number): SiteSyncExecutionPlan {
  const basePlan = buildSyncPlan(site);
  const lines = normalizeTailLines(tailLines);
  const commandPlan: ServerCommandStep[] = [
    {
      key: 'validate_nginx',
      label: '校验 Nginx/OpenResty 配置',
      command: 'nginx -t',
      required: true,
      risk: 'low',
      timeoutSeconds: 30,
    },
    {
      key: 'tail_nginx_access_log',
      label: `读取 access.log 最近 ${lines} 行`,
      command: `tail -n ${lines} /var/log/nginx/access.log || true`,
      preview: '/var/log/nginx/access.log',
      required: false,
      risk: 'low',
      timeoutSeconds: 20,
    },
    {
      key: 'tail_nginx_error_log',
      label: `读取 error.log 最近 ${lines} 行`,
      command: `tail -n ${lines} /var/log/nginx/error.log || true`,
      preview: '/var/log/nginx/error.log',
      required: false,
      risk: 'low',
      timeoutSeconds: 20,
    },
  ];

  return {
    ...basePlan,
    commandPlan,
    warnings: basePlan.warnings,
  };
}
