/** 监控域工具 - 告警条件与静默格式化。 */

import type { AlertRule, AlertSilence, Project } from './types';
import {
  resourceMetricLabels,
  resourceMetricAggregationLabels,
  resourceMetricOperatorLabels,
  statusLabels,
  severityLabels,
} from './constants';

export function formatCertificateExpiryCondition(value?: Record<string, unknown> | null) {
  if (!value) return '默认 14 天';
  const thresholdDays = typeof value.thresholdDays === 'number' ? value.thresholdDays : 14;
  return `${thresholdDays} 天内到期`;
}

export function formatCertificateAssetChangeCondition(value?: Record<string, unknown> | null) {
  if (!value) return '最近 24 小时';
  const windowHours = typeof value.windowHours === 'number' ? value.windowHours : 24;
  return `最近 ${windowHours} 小时变化`;
}

export function formatSmokeCheckCondition(value?: Record<string, unknown> | null) {
  if (!value) return '最近 3 次失败 >= 1';
  const windowRuns = typeof value.windowRuns === 'number' ? value.windowRuns : 3;
  const failureThreshold = typeof value.failureThreshold === 'number' ? value.failureThreshold : 1;
  return `最近 ${windowRuns} 次失败 >= ${failureThreshold}`;
}

export function formatResourceMetricCondition(value?: Record<string, unknown> | null) {
  if (!value) return '阈值规则';
  const metricName = typeof value.metricName === 'string' ? value.metricName : 'cpuPercent';
  const aggregation = typeof value.aggregation === 'string' ? value.aggregation : 'latest';
  const operator = typeof value.operator === 'string' ? value.operator : 'gte';
  const threshold = typeof value.threshold === 'number' ? value.threshold : undefined;
  const windowMinutes = typeof value.windowMinutes === 'number' ? value.windowMinutes : undefined;
  const metricLabel = resourceMetricLabels[metricName] || metricName;
  const aggregationLabel = resourceMetricAggregationLabels[aggregation] || aggregation;
  const operatorLabel = resourceMetricOperatorLabels[operator] || operator;
  const thresholdLabel = threshold === undefined ? '-' : String(threshold);
  const windowLabel = windowMinutes ? `${windowMinutes} 分钟` : '默认窗口';
  return `${metricLabel}${aggregationLabel} ${operatorLabel} ${thresholdLabel} · ${windowLabel}`;
}

export function formatServiceSloCondition(value?: Record<string, unknown> | null) {
  if (!value) return '目标 99% · 24 小时';
  const windows = Array.isArray(value.windows)
    ? value.windows
        .map((item) =>
          item && typeof item === 'object' && !Array.isArray(item)
            ? (item as Record<string, unknown>)
            : null,
        )
        .filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
  if (windows.length > 0) {
    const targetPercent = typeof value.targetPercent === 'number' ? value.targetPercent : 99;
    const policy = value.matchPolicy === 'all' ? '全部窗口' : '任一窗口';
    const windowLabels = windows.map((window, index) => {
      const label =
        typeof window.label === 'string' && window.label.trim()
          ? window.label.trim()
          : `窗口 ${index + 1}`;
      const windowMinutes =
        typeof window.windowMinutes === 'number' ? window.windowMinutes : index === 0 ? 60 : 360;
      const burnRateThreshold =
        typeof window.burnRateThreshold === 'number' ? window.burnRateThreshold : 1;
      return `${label} ${formatMetricWindow(windowMinutes)} burn ${burnRateThreshold}`;
    });
    return `目标 ${formatPercent(targetPercent)} · ${windowLabels.join(' / ')} · ${policy}`;
  }
  const targetPercent = typeof value.targetPercent === 'number' ? value.targetPercent : 99;
  const burnRateThreshold =
    typeof value.burnRateThreshold === 'number' ? value.burnRateThreshold : 1;
  const windowMinutes = typeof value.windowMinutes === 'number' ? value.windowMinutes : 1440;
  return `目标 ${formatPercent(targetPercent)} · burn ${burnRateThreshold} · ${formatMetricWindow(windowMinutes)}`;
}

export function formatServiceErrorBudgetCondition(value?: Record<string, unknown> | null) {
  if (!value) return '目标 99% · 剩余 <= 25% · 24 小时';
  const targetPercent = typeof value.targetPercent === 'number' ? value.targetPercent : 99;
  const threshold =
    typeof value.remainingThresholdPercent === 'number' ? value.remainingThresholdPercent : 25;
  const windowMinutes = typeof value.windowMinutes === 'number' ? value.windowMinutes : 1440;
  return `目标 ${formatPercent(targetPercent)} · 剩余 <= ${formatPercent(threshold)} · ${formatMetricWindow(windowMinutes)}`;
}

export function formatServiceErrorBudgetExhaustionCondition(
  value?: Record<string, unknown> | null,
) {
  if (!value) return '目标 99% · 24 小时内耗尽 · 24 小时';
  const targetPercent = typeof value.targetPercent === 'number' ? value.targetPercent : 99;
  const exhaustionWithinMinutes =
    typeof value.exhaustionWithinMinutes === 'number' ? value.exhaustionWithinMinutes : 1440;
  const windowMinutes = typeof value.windowMinutes === 'number' ? value.windowMinutes : 1440;
  return `目标 ${formatPercent(targetPercent)} · ${formatMetricWindow(exhaustionWithinMinutes)}内耗尽 · ${formatMetricWindow(windowMinutes)}`;
}

export function formatEvaluationMode(rule: AlertRule) {
  if (rule.evaluationMode === 'schedule') {
    return `定时评估 ${rule.intervalSeconds || 300}s`;
  }
  return '手动评估';
}

export function formatProjectName(projectId: string | null | undefined, projects: Project[]) {
  if (!projectId) return '全部项目';
  return projects.find((project) => project.id === projectId)?.name || projectId;
}

export function displaySilenceStatus(silence: AlertSilence) {
  if (silence.status !== 'active') return silence.status;
  if (silence.endsAt && new Date(silence.endsAt).getTime() <= Date.now()) return 'expired';
  return silence.status;
}

export function formatSilenceWindow(silence: AlertSilence) {
  return `${formatDate(silence.startsAt)} - ${silence.endsAt ? formatDate(silence.endsAt) : '长期'}`;
}

export function formatStatusList(statuses?: string[] | null) {
  const values = statuses && statuses.length > 0 ? statuses : ['firing', 'error'];
  return values.map((status) => statusLabels[status] || status).join('、');
}

export function formatSeverityList(severities?: string[] | null) {
  if (!severities || severities.length === 0) return '全部';
  return severities.map((severity) => severityLabels[severity] || severity).join('、');
}

export function formatPercent(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
}

export function formatMetricNumber(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatBytes(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let amount = value;
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }
  const digits = amount >= 10 || index === 0 ? 0 : 1;
  return `${amount.toFixed(digits)} ${units[index]}`;
}

export function formatMetricWindow(minutes: number) {
  if (!Number.isFinite(minutes)) return '-';
  if (minutes >= 1440) return `${Math.round(minutes / 1440)} 天`;
  if (minutes >= 60) return `${Math.round(minutes / 60)} 小时`;
  return `${minutes} 分钟`;
}

export function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
