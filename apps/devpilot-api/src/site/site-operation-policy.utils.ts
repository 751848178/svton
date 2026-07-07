/**
 * Pure site-operation policy helpers: action→mode mapping, risk/label, and
 * approval/confirmation requirements. Extracted from `SiteService`. Pure.
 */

import {
  type SiteOperationAction,
  type SiteOperationMode,
} from './site-plan.types';

export function modeForAction(action: SiteOperationAction): SiteOperationMode {
  if (action === 'site.rollback') return 'rollback';
  if (action === 'site.diagnostics') return 'diagnostics';
  if (action === 'site.openresty_module_baseline') return 'openresty_module_baseline';
  if (action === 'site.openresty_modules') return 'openresty_modules';
  if (action === 'site.openresty_status') return 'openresty_status';
  if (action === 'site.smoke_check') return 'smoke_check';
  if (action === 'site.tls_probe') return 'tls_probe';
  if (action === 'site.tls_renew') return 'tls_renew';
  return 'sync';
}

export function mutatesNginxConfig(mode: SiteOperationMode) {
  return mode === 'sync' || mode === 'rollback';
}

export function mutatesSiteStatus(mode: SiteOperationMode) {
  return mode === 'sync' || mode === 'rollback';
}

export function requiresSiteOperationApproval(action: SiteOperationAction, dryRun: boolean) {
  return !dryRun && (mutatesNginxConfig(modeForAction(action)) || action === 'site.tls_renew');
}

export function requiresExecutionConfirmation(action: SiteOperationAction) {
  return action === 'site.sync' || action === 'site.rollback' || action === 'site.tls_renew';
}

export function siteOperationRisk(action: SiteOperationAction) {
  if (action === 'site.rollback') return 'high';
  if (
    action === 'site.diagnostics' ||
    action === 'site.openresty_module_baseline' ||
    action === 'site.openresty_modules' ||
    action === 'site.openresty_status' ||
    action === 'site.smoke_check' ||
    action === 'site.tls_probe'
  ) {
    return 'low';
  }
  return 'medium';
}

export function siteOperationLabel(action: SiteOperationAction) {
  if (action === 'site.rollback') return '站点回滚';
  if (action === 'site.diagnostics') return '站点诊断';
  if (action === 'site.openresty_module_baseline') return 'OpenResty 模块基线检查';
  if (action === 'site.openresty_modules') return 'OpenResty 模块盘点';
  if (action === 'site.openresty_status') return 'OpenResty 运行态探测';
  if (action === 'site.smoke_check') return '站点 Smoke 检查';
  if (action === 'site.tls_probe') return 'TLS 证书探测';
  if (action === 'site.tls_renew') return 'TLS 证书续期';
  return '站点同步';
}
