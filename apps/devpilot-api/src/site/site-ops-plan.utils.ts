/**
 * Pure Site smoke-check + TLS probe/renew execution-plan builders + their
 * warning collectors. Extracted from `SiteService`. All functions are pure.
 */

import { ServerCommandStep } from '../server-executor';
import { buildSiteTlsProbeCommand } from './site-tls-probe';
import {
  buildCertificateRenewCommand,
  isSafeProbeHostname,
  isSafeUpstream,
  resolveCertificateName,
  resolveUpstream,
} from './site-config-gen.utils';
import {
  isRecord,
  readBoolean,
  readString,
  type JsonRecord,
  type SiteRecordLike,
  type SiteSyncExecutionPlan,
  type SiteRuntimeType,
} from './site-plan.types';

function collectTlsProbeWarnings(site: SiteRecordLike) {
  const warnings: string[] = [];
  if (!site.serverId) {
    warnings.push('未关联目标服务器，无法通过 Server executor 探测 TLS 证书');
  }
  if (!site.primaryDomain) {
    warnings.push('未配置主域名');
  } else if (!isSafeProbeHostname(site.primaryDomain)) {
    warnings.push('主域名不是可探测的安全域名，TLS 证书探测只支持普通域名，不支持通配符或特殊字符');
  }
  return warnings;
}

function collectSmokeCheckWarnings(site: SiteRecordLike) {
  const warnings: string[] = [];
  const runtimeConfig = isRecord(site.runtimeConfig) ? site.runtimeConfig : {};
  const upstream = resolveUpstream(site.runtimeType as SiteRuntimeType, runtimeConfig);

  if (!site.serverId) {
    warnings.push('未关联目标服务器，无法通过 Server executor 执行站点 Smoke 检查');
  }
  if (!site.primaryDomain) {
    warnings.push('未配置主域名');
  } else if (!isSafeProbeHostname(site.primaryDomain)) {
    warnings.push('主域名不是可探测的安全域名，Smoke 检查只支持普通域名，不支持通配符或特殊字符');
  }
  if (upstream && !isSafeUpstream(upstream)) {
    warnings.push('上游地址包含不安全字符，Smoke 检查不会生成上游访问命令');
  }
  return warnings;
}

function collectTlsRenewWarnings(site: SiteRecordLike, tls: JsonRecord, certName: string) {
  const warnings: string[] = [];
  if (!site.serverId) {
    warnings.push('未关联目标服务器，无法通过 Server executor 续期 TLS 证书');
  }
  if (!site.primaryDomain) {
    warnings.push('未配置主域名');
  } else if (!isSafeProbeHostname(site.primaryDomain)) {
    warnings.push('主域名不是可续期的安全域名，证书续期只支持普通域名，不支持通配符或特殊字符');
  }
  if (readBoolean(tls.enabled) !== true || readString(tls.type) !== 'letsencrypt') {
    warnings.push('当前站点未启用 Let’s Encrypt TLS，无法生成 certbot 续期计划');
  }
  if (!isSafeProbeHostname(certName)) {
    warnings.push('证书名称不是安全域名格式，无法生成 certbot 续期命令');
  }
  return warnings;
}

export function buildSmokeCheckPlan(site: SiteRecordLike): SiteSyncExecutionPlan {
  const warnings = collectSmokeCheckWarnings(site);
  const runtimeConfig = isRecord(site.runtimeConfig) ? site.runtimeConfig : {};
  const tls = isRecord(site.tls) ? site.tls : {};
  const scheme = readBoolean(tls.enabled) === true ? 'https' : 'http';
  const domainUrl = `${scheme}://${site.primaryDomain}`;
  const localUrl = 'http://127.0.0.1/';
  const upstream = resolveUpstream(site.runtimeType as SiteRuntimeType, runtimeConfig);
  const commandPlan: ServerCommandStep[] = [
    {
      key: 'public_domain_smoke',
      label: '访问公开域名',
      command: isSafeProbeHostname(site.primaryDomain) ? `curl -fsS ${domainUrl}` : '',
      preview: domainUrl,
      required: true,
      risk: 'low',
      timeoutSeconds: 20,
    },
    {
      key: 'nginx_local_host_smoke',
      label: '本机 Nginx Host 路由检查',
      command: isSafeProbeHostname(site.primaryDomain)
        ? `curl -fsS -H 'Host: ${site.primaryDomain}' ${localUrl}`
        : '',
      preview: `${localUrl} Host: ${site.primaryDomain}`,
      required: false,
      risk: 'low',
      timeoutSeconds: 20,
    },
    {
      key: 'upstream_smoke',
      label: '上游服务检查',
      command: upstream && isSafeUpstream(upstream) ? `curl -fsS ${upstream}` : '',
      preview: upstream || '未配置上游',
      required: false,
      risk: 'low',
      timeoutSeconds: 20,
    },
  ];

  return {
    target: { serverId: site.serverId, serverName: site.server?.name, serverHost: site.server?.host, configPath: `smoke://${site.primaryDomain}`, runtimeType: site.runtimeType },
    commandPlan,
    warnings,
    nginxConfig: '',
  };
}

export function buildTlsProbePlan(site: SiteRecordLike): SiteSyncExecutionPlan {
  const warnings = collectTlsProbeWarnings(site);
  const host = site.primaryDomain;
  const commandPlan: ServerCommandStep[] = [
    {
      key: 'probe_tls_certificate',
      label: '探测站点 TLS 证书',
      command: isSafeProbeHostname(host) ? buildSiteTlsProbeCommand(host, 443) : '',
      preview: `${host}:443`,
      required: true,
      risk: 'low',
      timeoutSeconds: 20,
    },
  ];

  return {
    target: { serverId: site.serverId, serverName: site.server?.name, serverHost: site.server?.host, configPath: `tls://${host}:443`, runtimeType: site.runtimeType },
    commandPlan,
    warnings,
    nginxConfig: '',
  };
}

export function buildTlsRenewPlan(site: SiteRecordLike, dryRun: boolean): SiteSyncExecutionPlan {
  const tls = isRecord(site.tls) ? site.tls : {};
  const certName = resolveCertificateName(site, tls);
  const warnings = collectTlsRenewWarnings(site, tls, certName);
  const commandPlan: ServerCommandStep[] = [
    {
      key: 'renew_tls_certificate',
      label: dryRun ? '演练续期 TLS 证书' : '续期 TLS 证书',
      command: isSafeProbeHostname(certName)
        ? buildCertificateRenewCommand(certName, dryRun)
        : '',
      preview: certName,
      required: true,
      risk: dryRun ? 'low' : 'medium',
      timeoutSeconds: dryRun ? 240 : 300,
    },
    {
      key: 'validate_nginx',
      label: '校验 Nginx/OpenResty 配置',
      command: 'nginx -t',
      required: !dryRun,
      risk: 'low',
      timeoutSeconds: 30,
    },
    {
      key: 'reload_nginx',
      label: '重载 Nginx/OpenResty',
      command: 'systemctl reload nginx || nginx -s reload',
      required: !dryRun,
      risk: 'medium',
      timeoutSeconds: 30,
    },
  ];

  return {
    target: { serverId: site.serverId, serverName: site.server?.name, serverHost: site.server?.host, configPath: `tls-renew://${certName}`, runtimeType: site.runtimeType },
    commandPlan,
    warnings,
    nginxConfig: '',
  };
}
