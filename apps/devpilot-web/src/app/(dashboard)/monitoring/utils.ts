/** 监控域工具 - 目标/规则/事件格式化。 */

import type { AlertRule, AlertEvent, Project } from './types';
import type { TargetType } from './types-dashboard';
import {
  formatCertificateExpiryCondition,
  formatCertificateAssetChangeCondition,
  formatSmokeCheckCondition,
  formatResourceMetricCondition,
  formatServiceSloCondition,
  formatServiceErrorBudgetCondition,
  formatServiceErrorBudgetExhaustionCondition,
} from './utils-format';
import { categoryLabels, metricLabels, severityLabels } from './constants';

export function formatTargetType(targetType: TargetType) {
  if (targetType === 'service_slo') return '服务 SLO';
  if (targetType === 'service_error_budget') return '错误预算';
  if (targetType === 'service_error_budget_exhaustion') return '预算耗尽预测';
  if (targetType === 'site_certificate') return '站点证书';
  if (targetType === 'site_certificate_asset') return '证书变化';
  if (targetType === 'site_tls_renewal') return 'TLS 续期';
  if (targetType === 'site_smoke_check') return 'Smoke 检查';
  if (targetType === 'deployment_smoke_check') return '部署 Smoke';
  if (targetType === 'resource_metric') return '资源指标';
  return categoryLabels[targetType] || targetType;
}

export function defaultRuleName(targetType: TargetType) {
  if (targetType === 'service_slo') return '服务 SLO 违约告警';
  if (targetType === 'service_error_budget') return '服务错误预算告警';
  if (targetType === 'service_error_budget_exhaustion') return '服务错误预算耗尽预测';
  if (targetType === 'site_certificate') return '站点证书过期告警';
  if (targetType === 'site_certificate_asset') return '证书变化告警';
  if (targetType === 'site_tls_renewal') return 'TLS 续期失败告警';
  if (targetType === 'site_smoke_check') return '站点 Smoke 检查失败告警';
  if (targetType === 'deployment_smoke_check') return '部署 Smoke 检查失败告警';
  if (targetType === 'cloud_sync') return '云同步失败告警';
  if (targetType === 'log') return '日志错误数告警';
  if (targetType === 'resource_metric') return '资源指标阈值告警';
  return `${formatTargetType(targetType)}状态告警`;
}

export function formatRuleTarget(rule: AlertRule) {
  if (rule.metric === 'service_slo_breach') {
    return `${rule.applicationService?.name || '服务'} · ${formatServiceSloCondition(rule.condition)}`;
  }
  if (rule.metric === 'service_error_budget') {
    return `${rule.applicationService?.name || '服务'} · ${formatServiceErrorBudgetCondition(rule.condition)}`;
  }
  if (rule.metric === 'service_error_budget_exhaustion') {
    return `${rule.applicationService?.name || '服务'} · ${formatServiceErrorBudgetExhaustionCondition(rule.condition)}`;
  }
  if (rule.metric === 'certificate_expiry') {
    return `${rule.site?.name || '站点证书'} · ${formatCertificateExpiryCondition(rule.condition)}`;
  }
  if (rule.metric === 'certificate_asset_change') {
    return `${rule.site?.name || '站点证书'} · ${formatCertificateAssetChangeCondition(rule.condition)}`;
  }
  if (rule.metric === 'tls_renewal_failure') {
    return `${rule.site?.name || '站点'} · TLS 续期失败`;
  }
  if (rule.metric === 'site_smoke_check_failure') {
    return `${rule.site?.name || '站点'} · ${formatSmokeCheckCondition(rule.condition)}`;
  }
  if (rule.metric === 'deployment_smoke_check_failure') {
    return `${rule.project?.name || '项目部署'} · ${formatSmokeCheckCondition(rule.condition)}`;
  }
  if (rule.metric === 'resource_metric_threshold') {
    return `${rule.managedResource?.name || rule.project?.name || '资源指标'} · ${formatResourceMetricCondition(rule.condition)}`;
  }
  if (rule.metric === 'cloud_provider_sync_failure') {
    return rule.project?.name ? `${rule.project.name} 云同步` : '全部项目云同步';
  }
  if (rule.category === 'log') {
    return rule.project?.name ? `${rule.project.name} 日志` : '全部项目日志';
  }
  return (
    rule.applicationService?.name ||
    rule.server?.name ||
    rule.site?.name ||
    rule.managedResource?.name ||
    rule.backupPlan?.name ||
    rule.project?.name ||
    '-'
  );
}

export function formatEventTarget(event: AlertEvent) {
  if (event.metric === 'service_slo_breach') {
    return event.applicationService?.name ? `${event.applicationService.name} SLO` : '服务 SLO';
  }
  if (event.metric === 'service_error_budget') {
    return event.applicationService?.name
      ? `${event.applicationService.name} 错误预算`
      : '服务错误预算';
  }
  if (event.metric === 'service_error_budget_exhaustion') {
    return event.applicationService?.name
      ? `${event.applicationService.name} 预算耗尽预测`
      : '错误预算耗尽预测';
  }
  if (event.metric === 'certificate_expiry') {
    return event.site?.name ? `${event.site.name} 证书` : '站点证书';
  }
  if (event.metric === 'certificate_asset_change') {
    return event.site?.name ? `${event.site.name} 证书变化` : '证书变化';
  }
  if (event.metric === 'tls_renewal_failure') {
    return event.site?.name ? `${event.site.name} TLS 续期` : 'TLS 续期';
  }
  if (event.metric === 'site_smoke_check_failure') {
    return event.site?.name ? `${event.site.name} Smoke 检查` : 'Smoke 检查';
  }
  if (event.metric === 'deployment_smoke_check_failure') {
    return event.project?.name ? `${event.project.name} 部署 Smoke` : '部署 Smoke';
  }
  if (event.metric === 'resource_metric_threshold') {
    return event.managedResource?.name || event.project?.name || '资源指标';
  }
  if (event.metric === 'cloud_provider_sync_failure') {
    return event.project?.name ? `${event.project.name} 云同步` : '全部项目云同步';
  }
  if (event.category === 'log') {
    return event.project?.name ? `${event.project.name} 日志` : '全部项目日志';
  }
  return (
    event.applicationService?.name ||
    event.server?.name ||
    event.site?.name ||
    event.managedResource?.name ||
    event.backupPlan?.name ||
    event.project?.name ||
    '-'
  );
}
