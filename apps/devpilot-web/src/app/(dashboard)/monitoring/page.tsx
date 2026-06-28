'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

interface Project {
  id: string;
  name: string;
}

interface ApplicationServiceItem {
  id: string;
  name: string;
  kind: string;
  status: string;
  environment?: { id: string; key: string; name: string; status: string } | null;
  server?: { id: string; name: string; host: string } | null;
}

interface ApplicationItem {
  id: string;
  name: string;
  projectId: string;
  project?: Project | null;
  services: ApplicationServiceItem[];
}

interface Server {
  id: string;
  name: string;
  host: string;
  status: string;
}

interface Site {
  id: string;
  name: string;
  primaryDomain: string;
  status: string;
}

interface ManagedResource {
  id: string;
  name: string;
  sourceType: string;
  provider: string;
  kind: string;
  status: string;
}

interface BackupPlan {
  id: string;
  name: string;
  status: string;
  lastStatus?: string | null;
}

interface AlertRule {
  id: string;
  name: string;
  category: string;
  metric: string;
  severity: string;
  enabled: boolean;
  evaluationMode: string;
  intervalSeconds: number;
  condition?: Record<string, unknown> | null;
  lastStatus?: string | null;
  lastMessage?: string | null;
  lastEvaluatedAt?: string | null;
  project?: Project | null;
  environment?: { id: string; key: string; name: string; status: string } | null;
  applicationService?: { id: string; name: string; kind: string; status: string } | null;
  server?: Server | null;
  site?: Site | null;
  managedResource?: ManagedResource | null;
  backupPlan?: BackupPlan | null;
  events?: Array<{ id: string; status: string; severity: string; summary?: string | null; occurredAt: string }>;
}

interface AlertEvent {
  id: string;
  category: string;
  metric: string;
  severity: string;
  status: string;
  summary?: string | null;
  occurredAt: string;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  rule?: { id: string; name: string; metric: string; severity: string; enabled: boolean } | null;
  project?: Project | null;
  environment?: { id: string; key: string; name: string; status: string } | null;
  applicationService?: { id: string; name: string; kind: string; status: string } | null;
  server?: Server | null;
  site?: Site | null;
  managedResource?: ManagedResource | null;
  backupPlan?: BackupPlan | null;
}

interface AlertSilence {
  id: string;
  name: string;
  status: string;
  projectId?: string | null;
  environmentId?: string | null;
  category?: string | null;
  metric?: string | null;
  severityFilter?: string[] | null;
  startsAt: string;
  endsAt?: string | null;
  reason?: string | null;
  project?: Project | null;
  environment?: { id: string; key: string; name: string; status: string } | null;
}

interface AlertNotificationChannel {
  id: string;
  name: string;
  type: string;
  status: string;
  projectId?: string | null;
  environmentId?: string | null;
  config?: { target?: string; method?: string; liveEnabled?: boolean; recipientCount?: number; subjectPrefix?: string } | null;
  eventStatuses?: string[] | null;
  severityFilter?: string[] | null;
  lastStatus?: string | null;
  lastDeliveredAt?: string | null;
  lastError?: string | null;
  createdAt: string;
}

interface AlertNotificationDelivery {
  id: string;
  channelId: string;
  alertEventId: string;
  channelType: string;
  status: string;
  dryRun: boolean;
  target?: string | null;
  responseStatus?: number | null;
  error?: string | null;
  attemptedAt?: string | null;
  createdAt: string;
  channel?: {
    id: string;
    name: string;
    type: string;
    status: string;
    projectId?: string | null;
    environmentId?: string | null;
  } | null;
  alertEvent?: {
    id: string;
    category: string;
    metric: string;
    severity: string;
    status: string;
    summary?: string | null;
    occurredAt: string;
    rule?: { id: string; name: string } | null;
  } | null;
}

interface ResourceMetricDashboardValue {
  latest?: number | null;
  average?: number | null;
  max?: number | null;
  delta?: number | null;
}

interface ResourceMetricDashboardRow {
  id: string;
  resourceId: string;
  sourceType: string;
  provider: string;
  kind: string;
  metricSource: string;
  status: 'ok' | 'warning' | 'critical' | 'stale';
  statusReason: string;
  sampleCount: number;
  firstSampledAt: string;
  lastSampledAt: string;
  minutesSinceLastSample: number;
  resource?: {
    id: string;
    name: string;
    sourceType: string;
    provider: string;
    kind: string;
    status: string;
    endpoint?: string | null;
    project?: Project | null;
    environment?: { id: string; key: string; name: string; status: string } | null;
  } | null;
  cpuPercent: ResourceMetricDashboardValue;
  memoryPercent: ResourceMetricDashboardValue;
  memoryUsageBytes: ResourceMetricDashboardValue;
  networkInputBytes: ResourceMetricDashboardValue;
  networkOutputBytes: ResourceMetricDashboardValue;
  blockInputBytes: ResourceMetricDashboardValue;
  blockOutputBytes: ResourceMetricDashboardValue;
  pids: ResourceMetricDashboardValue;
}

interface ResourceMetricDashboard {
  generatedAt: string;
  windowMinutes: number;
  staleAfterMinutes: number;
  resourceCount: number;
  sampleCount: number;
  okCount: number;
  warningCount: number;
  criticalCount: number;
  staleCount: number;
  maxCpuPercent?: number | null;
  maxMemoryPercent?: number | null;
  maxPids?: number | null;
  rows: ResourceMetricDashboardRow[];
}

type ServiceSloStatus = 'ok' | 'warning' | 'critical' | 'no_data';

interface ServiceSloDashboardRow {
  id: string;
  serviceId: string;
  projectId: string;
  environmentId: string;
  applicationId: string;
  status: ServiceSloStatus;
  statusReason: string;
  targetPercent: number;
  sloPercent?: number | null;
  errorBudgetRemainingPercent?: number | null;
  burnRate?: number | null;
  deploymentCount: number;
  deploymentSuccessCount: number;
  deploymentFailureCount: number;
  operationCount: number;
  operationSuccessCount: number;
  operationFailureCount: number;
  alertImpactCount: number;
  criticalAlertCount: number;
  service: {
    id: string;
    name: string;
    kind: string;
    status: string;
    runtime?: string | null;
    project?: { id: string; name: string } | null;
    environment?: { id: string; key: string; name: string; status: string } | null;
    application?: { id: string; name: string; status: string } | null;
  };
}

interface ServiceSloDashboard {
  generatedAt: string;
  windowMinutes: number;
  targetPercent: number;
  serviceCount: number;
  okCount: number;
  warningCount: number;
  criticalCount: number;
  noDataCount: number;
  averageSloPercent?: number | null;
  deploymentCount: number;
  deploymentFailureCount: number;
  operationCount: number;
  operationFailureCount: number;
  alertImpactCount: number;
  criticalAlertCount: number;
  rows: ServiceSloDashboardRow[];
}

interface ServiceSloRuleTemplate {
  id: string;
  name: string;
  description: string;
  targetType: 'service_slo' | 'service_error_budget' | 'service_error_budget_exhaustion';
  category: 'service';
  metric: 'service_slo_breach' | 'service_error_budget' | 'service_error_budget_exhaustion';
  severity: 'warning' | 'critical';
  evaluationMode: 'manual' | 'schedule';
  intervalSeconds: number;
  condition: Record<string, unknown>;
}

type TargetType =
  | 'service'
  | 'service_slo'
  | 'service_error_budget'
  | 'service_error_budget_exhaustion'
  | 'server'
  | 'site'
  | 'site_certificate'
  | 'site_certificate_asset'
  | 'site_tls_renewal'
  | 'site_smoke_check'
  | 'resource'
  | 'resource_metric'
  | 'backup'
  | 'deployment'
  | 'deployment_smoke_check'
  | 'cloud_sync'
  | 'log';

const categoryLabels: Record<string, string> = {
  service: '服务',
  server: '服务器',
  site: '站点',
  resource: '资源',
  backup: '备份',
  deployment: '部署',
  cloud_sync: '云同步',
  log: '日志',
};

const metricLabels: Record<string, string> = {
  service_status: '服务状态',
  service_slo_breach: '服务 SLO 违约',
  service_error_budget: '服务错误预算',
  service_error_budget_exhaustion: '错误预算耗尽预测',
  server_status: '服务器状态',
  site_status: '站点状态',
  certificate_expiry: '证书过期',
  certificate_asset_change: '证书变化',
  tls_renewal_failure: 'TLS 续期失败',
  site_smoke_check_failure: 'Smoke 检查失败',
  resource_status: '资源状态',
  resource_metric_threshold: '资源指标阈值',
  backup_status: '备份状态',
  deployment_status: '部署状态',
  deployment_smoke_check_failure: '部署 Smoke 失败',
  cloud_provider_sync_failure: '云同步失败',
  log_error_count: '日志错误数',
  log_warning_count: '日志警告数',
  log_fatal_count: '致命日志数',
};

const cloudProviderLabels: Record<string, string> = {
  all: '全部 Provider',
  'aliyun-rds': '阿里云 RDS',
  'aliyun-sls': '阿里云 SLS',
  'tencent-cos': '腾讯云 COS',
};

const resourceMetricLabels: Record<string, string> = {
  cpuPercent: 'CPU',
  memoryPercent: '内存',
  memoryUsageBytes: '内存用量',
  pids: 'PIDs',
};

const resourceMetricAggregationLabels: Record<string, string> = {
  latest: '当前值',
  average: '平均值',
  max: '峰值',
};

const resourceMetricOperatorLabels: Record<string, string> = {
  gte: '>=',
  gt: '>',
  lte: '<=',
  lt: '<',
};

const notificationChannelTypeLabels: Record<string, string> = {
  webhook: '通用 Webhook',
  feishu: '飞书机器人',
  dingtalk: '钉钉机器人',
  wecom: '企业微信机器人',
  email: '邮件',
};

const notificationChannelTargetPlaceholders: Record<string, string> = {
  webhook: 'https://example.com/hooks/alerts',
  feishu: 'https://open.feishu.cn/open-apis/bot/v2/hook/...',
  dingtalk: 'https://oapi.dingtalk.com/robot/send?access_token=...',
  wecom: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...',
  email: 'ops@example.com, sre@example.com',
};

const severityLabels: Record<string, string> = {
  info: '提示',
  warning: '警告',
  critical: '严重',
};

const statusLabels: Record<string, string> = {
  ok: '正常',
  firing: '触发',
  resolved: '已恢复',
  insufficient_data: '数据不足',
  error: '错误',
  acknowledged: '已确认',
  suppressed: '已静默',
  active: '启用',
  paused: '暂停',
  archived: '归档',
  expired: '已过期',
  planned: '计划',
  sent: '已发送',
  failed: '失败',
  skipped: '跳过',
  stale: '样本过期',
  no_data: '暂无数据',
};

const statusClasses: Record<string, string> = {
  ok: 'bg-green-100 text-green-700',
  resolved: 'bg-green-100 text-green-700',
  active: 'bg-green-100 text-green-700',
  sent: 'bg-green-100 text-green-700',
  firing: 'bg-red-100 text-red-700',
  critical: 'bg-red-100 text-red-700',
  warning: 'bg-yellow-100 text-yellow-700',
  insufficient_data: 'bg-yellow-100 text-yellow-700',
  acknowledged: 'bg-blue-100 text-blue-700',
  suppressed: 'bg-purple-100 text-purple-700',
  paused: 'bg-blue-100 text-blue-700',
  planned: 'bg-blue-100 text-blue-700',
  archived: 'bg-gray-100 text-gray-700',
  expired: 'bg-gray-100 text-gray-700',
  skipped: 'bg-gray-100 text-gray-700',
  stale: 'bg-yellow-100 text-yellow-700',
  no_data: 'bg-gray-100 text-gray-700',
  error: 'bg-red-100 text-red-700',
  failed: 'bg-red-100 text-red-700',
};

const severityClasses: Record<string, string> = {
  info: 'bg-gray-100 text-gray-700',
  warning: 'bg-yellow-100 text-yellow-700',
  critical: 'bg-red-100 text-red-700',
};

export default function MonitoringPage() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [silences, setSilences] = useState<AlertSilence[]>([]);
  const [channels, setChannels] = useState<AlertNotificationChannel[]>([]);
  const [deliveries, setDeliveries] = useState<AlertNotificationDelivery[]>([]);
  const [resourceMetricDashboard, setResourceMetricDashboard] = useState<ResourceMetricDashboard | null>(null);
  const [serviceSloDashboard, setServiceSloDashboard] = useState<ServiceSloDashboard | null>(null);
  const [serviceSloTemplates, setServiceSloTemplates] = useState<ServiceSloRuleTemplate[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [resources, setResources] = useState<ManagedResource[]>([]);
  const [backupPlans, setBackupPlans] = useState<BackupPlan[]>([]);
  const [targetType, setTargetType] = useState<TargetType>('service');
  const [targetId, setTargetId] = useState('');
  const [cloudProvider, setCloudProvider] = useState('all');
  const [certificateThresholdDays, setCertificateThresholdDays] = useState(14);
  const [certificateAssetWindowHours, setCertificateAssetWindowHours] = useState(24);
  const [smokeCheckWindowRuns, setSmokeCheckWindowRuns] = useState(3);
  const [smokeCheckFailureThreshold, setSmokeCheckFailureThreshold] = useState(1);
  const [resourceMetricName, setResourceMetricName] = useState('cpuPercent');
  const [resourceMetricAggregation, setResourceMetricAggregation] = useState('latest');
  const [resourceMetricOperator, setResourceMetricOperator] = useState('gte');
  const [resourceMetricThreshold, setResourceMetricThreshold] = useState(80);
  const [resourceMetricWindowMinutes, setResourceMetricWindowMinutes] = useState(15);
  const [sloRuleStrategy, setSloRuleStrategy] = useState<'single_window' | 'multi_window_burn_rate'>('single_window');
  const [sloRuleTargetPercent, setSloRuleTargetPercent] = useState(99);
  const [sloRuleBurnRateThreshold, setSloRuleBurnRateThreshold] = useState(1);
  const [sloRuleWindowMinutes, setSloRuleWindowMinutes] = useState(1440);
  const [sloRuleShortWindowMinutes, setSloRuleShortWindowMinutes] = useState(60);
  const [sloRuleShortBurnRateThreshold, setSloRuleShortBurnRateThreshold] = useState(14);
  const [sloRuleLongWindowMinutes, setSloRuleLongWindowMinutes] = useState(360);
  const [sloRuleLongBurnRateThreshold, setSloRuleLongBurnRateThreshold] = useState(6);
  const [sloErrorBudgetRemainingThresholdPercent, setSloErrorBudgetRemainingThresholdPercent] = useState(25);
  const [sloErrorBudgetExhaustionWithinMinutes, setSloErrorBudgetExhaustionWithinMinutes] = useState(1440);
  const [selectedSloTemplateId, setSelectedSloTemplateId] = useState('');
  const [name, setName] = useState('');
  const [severity, setSeverity] = useState<'info' | 'warning' | 'critical'>('warning');
  const [evaluationMode, setEvaluationMode] = useState<'manual' | 'schedule'>('manual');
  const [intervalSeconds, setIntervalSeconds] = useState(300);
  const [silenceName, setSilenceName] = useState('');
  const [silenceProjectId, setSilenceProjectId] = useState('');
  const [silenceCategory, setSilenceCategory] = useState('');
  const [silenceDurationMinutes, setSilenceDurationMinutes] = useState(60);
  const [silenceSeverityFilter, setSilenceSeverityFilter] = useState<string[]>([]);
  const [silenceReason, setSilenceReason] = useState('');
  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState<'webhook' | 'feishu' | 'dingtalk' | 'wecom' | 'email'>('webhook');
  const [channelWebhookUrl, setChannelWebhookUrl] = useState('');
  const [channelEmailRecipients, setChannelEmailRecipients] = useState('');
  const [channelEmailSubjectPrefix, setChannelEmailSubjectPrefix] = useState('Devpilot Alert');
  const [channelProjectId, setChannelProjectId] = useState('');
  const [channelEventStatuses, setChannelEventStatuses] = useState<string[]>(['firing', 'error']);
  const [channelSeverityFilter, setChannelSeverityFilter] = useState<string[]>([]);
  const [resourceMetricDashboardWindow, setResourceMetricDashboardWindow] = useState('360');
  const [serviceSloDashboardWindow, setServiceSloDashboardWindow] = useState('1440');
  const [serviceSloTargetPercent, setServiceSloTargetPercent] = useState('99');
  const [loadingResourceMetricDashboard, setLoadingResourceMetricDashboard] = useState(false);
  const [loadingServiceSloDashboard, setLoadingServiceSloDashboard] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSilence, setSavingSilence] = useState(false);
  const [savingChannel, setSavingChannel] = useState(false);
  const [evaluatingId, setEvaluatingId] = useState('');
  const [acknowledgingId, setAcknowledgingId] = useState('');
  const [updatingSilenceId, setUpdatingSilenceId] = useState('');
  const [updatingChannelId, setUpdatingChannelId] = useState('');
  const [retryingDeliveryId, setRetryingDeliveryId] = useState('');
  const [error, setError] = useState('');

  const services = useMemo(() => {
    return applications.flatMap((application) => (
      application.services.map((service) => ({
        ...service,
        applicationName: application.name,
        projectName: application.project?.name,
      }))
    ));
  }, [applications]);

  const targetOptions = useMemo(() => {
    if (
      targetType === 'service'
      || targetType === 'service_slo'
      || targetType === 'service_error_budget'
      || targetType === 'service_error_budget_exhaustion'
    ) {
      return services.map((service) => ({
        id: service.id,
        label: `${service.applicationName} / ${service.name} · ${service.status}`,
      }));
    }
    if (targetType === 'server') {
      return servers.map((server) => ({ id: server.id, label: `${server.name} · ${server.host} · ${server.status}` }));
    }
    if (
      targetType === 'site'
      || targetType === 'site_certificate'
      || targetType === 'site_certificate_asset'
      || targetType === 'site_tls_renewal'
      || targetType === 'site_smoke_check'
    ) {
      return sites.map((site) => ({ id: site.id, label: `${site.name} · ${site.primaryDomain} · ${site.status}` }));
    }
    if (targetType === 'resource' || targetType === 'resource_metric') {
      return resources.map((resource) => ({
        id: resource.id,
        label: `${resource.name} · ${resource.provider}/${resource.kind} · ${resource.status}`,
      }));
    }
    if (targetType === 'backup') {
      return backupPlans.map((plan) => ({
        id: plan.id,
        label: `${plan.name} · ${plan.lastStatus || plan.status}`,
      }));
    }
    if (targetType === 'cloud_sync') {
      return [
        { id: 'all', label: '全部项目' },
        ...projects.map((project) => ({ id: project.id, label: project.name })),
      ];
    }
    if (targetType === 'log') {
      return [
        { id: 'all', label: '全部项目' },
        ...projects.map((project) => ({ id: project.id, label: project.name })),
      ];
    }
    return projects.map((project) => ({ id: project.id, label: project.name }));
  }, [backupPlans, projects, resources, servers, services, sites, targetType]);

  const stats = useMemo(() => ({
    rules: rules.length,
    enabled: rules.filter((rule) => rule.enabled).length,
    firing: events.filter((event) => event.status === 'firing').length,
    critical: events.filter((event) => event.severity === 'critical' && event.status === 'firing').length,
    suppressed: events.filter((event) => event.status === 'suppressed').length,
  }), [events, rules]);

  const loadData = async () => {
    setError('');
    try {
      const [
        ruleData,
        eventData,
        silenceData,
        channelData,
        deliveryData,
        metricDashboardData,
        serviceSloDashboardData,
        sloTemplateData,
        projectData,
        appData,
        serverData,
        siteData,
        resourceData,
        backupData,
      ] = await Promise.all([
        api.get<AlertRule[]>('/monitoring/alert-rules'),
        api.get<AlertEvent[]>('/monitoring/alert-events'),
        api.get<AlertSilence[]>('/monitoring/silences'),
        api.get<AlertNotificationChannel[]>('/monitoring/notification-channels'),
        api.get<AlertNotificationDelivery[]>('/monitoring/notification-deliveries'),
        api.get<ResourceMetricDashboard>('/monitoring/resource-metrics/dashboard', {
          params: { windowMinutes: resourceMetricDashboardWindow, limit: '12' },
        }),
        api.get<ServiceSloDashboard>('/monitoring/service-slo/dashboard', {
          params: {
            windowMinutes: serviceSloDashboardWindow,
            targetPercent: serviceSloTargetPercent,
            limit: '12',
          },
        }),
        api.get<ServiceSloRuleTemplate[]>('/monitoring/service-slo/templates'),
        api.get<Project[]>('/projects'),
        api.get<ApplicationItem[]>('/applications'),
        api.get<Server[]>('/servers'),
        api.get<Site[]>('/sites'),
        api.get<ManagedResource[]>('/resource-control/resources'),
        api.get<BackupPlan[]>('/backups/plans'),
      ]);
      setRules(ruleData);
      setEvents(eventData);
      setSilences(silenceData);
      setChannels(channelData);
      setDeliveries(deliveryData);
      setResourceMetricDashboard(metricDashboardData);
      setServiceSloDashboard(serviceSloDashboardData);
      setServiceSloTemplates(sloTemplateData);
      setProjects(projectData);
      setApplications(appData);
      setServers(serverData);
      setSites(siteData);
      setResources(resourceData);
      setBackupPlans(backupData);
      setTargetId((current) => current || appData[0]?.services[0]?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载监控告警数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadResourceMetricDashboard = async (windowMinutes = resourceMetricDashboardWindow) => {
    setLoadingResourceMetricDashboard(true);
    setError('');
    try {
      const data = await api.get<ResourceMetricDashboard>('/monitoring/resource-metrics/dashboard', {
        params: { windowMinutes, limit: '12' },
      });
      setResourceMetricDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载资源指标大盘失败');
    } finally {
      setLoadingResourceMetricDashboard(false);
    }
  };

  const loadServiceSloDashboard = async (
    windowMinutes = serviceSloDashboardWindow,
    targetPercent = serviceSloTargetPercent,
  ) => {
    setLoadingServiceSloDashboard(true);
    setError('');
    try {
      const data = await api.get<ServiceSloDashboard>('/monitoring/service-slo/dashboard', {
        params: { windowMinutes, targetPercent, limit: '12' },
      });
      setServiceSloDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载服务 SLO 大盘失败');
    } finally {
      setLoadingServiceSloDashboard(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setTargetId((current) => (
      targetOptions.some((option) => option.id === current)
        ? current
        : targetOptions[0]?.id || ''
    ));
  }, [targetOptions]);

  const applyServiceSloTemplate = (templateId: string) => {
    setSelectedSloTemplateId(templateId);
    const template = serviceSloTemplates.find((item) => item.id === templateId);
    if (!template) return;

    const condition = template.condition || {};
    const readNumber = (value: unknown, fallback: number) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const windows = Array.isArray(condition.windows)
      ? condition.windows.filter((window): window is Record<string, unknown> => (
        Boolean(window) && typeof window === 'object' && !Array.isArray(window)
      ))
      : [];
    const firstWindow = windows[0];
    const secondWindow = windows[1] || windows[0];

    setTargetType(template.targetType);
    setName(template.name);
    setSeverity(template.severity);
    setEvaluationMode(template.evaluationMode === 'schedule' ? 'schedule' : 'manual');
    setIntervalSeconds(readNumber(template.intervalSeconds, 300));

    if (template.targetType === 'service_slo') {
      const strategy = condition.strategy === 'multi_window_burn_rate'
        ? 'multi_window_burn_rate'
        : 'single_window';
      const targetPercent = readNumber(condition.targetPercent ?? firstWindow?.targetPercent, 99);
      setSloRuleStrategy(strategy);
      setSloRuleTargetPercent(targetPercent);
      if (strategy === 'multi_window_burn_rate') {
        setSloRuleShortWindowMinutes(readNumber(firstWindow?.windowMinutes, 60));
        setSloRuleShortBurnRateThreshold(readNumber(firstWindow?.burnRateThreshold, 14));
        setSloRuleLongWindowMinutes(readNumber(secondWindow?.windowMinutes, 360));
        setSloRuleLongBurnRateThreshold(readNumber(secondWindow?.burnRateThreshold, 6));
      } else {
        setSloRuleWindowMinutes(readNumber(condition.windowMinutes, 1440));
        setSloRuleBurnRateThreshold(readNumber(condition.burnRateThreshold, 1));
      }
    }

    if (template.targetType === 'service_error_budget') {
      setSloRuleStrategy('single_window');
      setSloRuleTargetPercent(readNumber(condition.targetPercent, 99));
      setSloRuleWindowMinutes(readNumber(condition.windowMinutes, 10080));
      setSloErrorBudgetRemainingThresholdPercent(readNumber(condition.remainingThresholdPercent, 25));
    }

    if (template.targetType === 'service_error_budget_exhaustion') {
      setSloRuleStrategy('single_window');
      setSloRuleTargetPercent(readNumber(condition.targetPercent, 99));
      setSloRuleWindowMinutes(readNumber(condition.windowMinutes, 1440));
      setSloErrorBudgetExhaustionWithinMinutes(readNumber(condition.exhaustionWithinMinutes, 1440));
    }
  };

  const createRule = async () => {
    if (!targetId) {
      alert('请选择告警目标');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        name: name.trim() || defaultRuleName(targetType),
        category: targetType === 'cloud_sync'
          ? 'resource'
          : ((targetType === 'service_slo'
            || targetType === 'service_error_budget'
            || targetType === 'service_error_budget_exhaustion') ? 'service' : targetType),
        severity,
        evaluationMode,
        intervalSeconds,
      };
      if (targetType === 'service') body.applicationServiceId = targetId;
      if (targetType === 'service_slo') {
        body.category = 'service';
        body.metric = 'service_slo_breach';
        body.applicationServiceId = targetId;
        body.condition = sloRuleStrategy === 'multi_window_burn_rate'
          ? {
            strategy: 'multi_window_burn_rate',
            matchPolicy: 'all',
            targetPercent: sloRuleTargetPercent,
            windows: [
              {
                label: '短窗口',
                windowMinutes: sloRuleShortWindowMinutes,
                targetPercent: sloRuleTargetPercent,
                burnRateThreshold: sloRuleShortBurnRateThreshold,
              },
              {
                label: '长窗口',
                windowMinutes: sloRuleLongWindowMinutes,
                targetPercent: sloRuleTargetPercent,
                burnRateThreshold: sloRuleLongBurnRateThreshold,
              },
            ],
          }
          : {
            strategy: 'single_window',
            windowMinutes: sloRuleWindowMinutes,
            targetPercent: sloRuleTargetPercent,
            burnRateThreshold: sloRuleBurnRateThreshold,
          };
      }
      if (targetType === 'service_error_budget') {
        body.category = 'service';
        body.metric = 'service_error_budget';
        body.applicationServiceId = targetId;
        body.condition = {
          windowMinutes: sloRuleWindowMinutes,
          targetPercent: sloRuleTargetPercent,
          remainingThresholdPercent: sloErrorBudgetRemainingThresholdPercent,
        };
      }
      if (targetType === 'service_error_budget_exhaustion') {
        body.category = 'service';
        body.metric = 'service_error_budget_exhaustion';
        body.applicationServiceId = targetId;
        body.condition = {
          windowMinutes: sloRuleWindowMinutes,
          targetPercent: sloRuleTargetPercent,
          exhaustionWithinMinutes: sloErrorBudgetExhaustionWithinMinutes,
        };
      }
      if (targetType === 'server') body.serverId = targetId;
      if (targetType === 'site') body.siteId = targetId;
      if (targetType === 'site_certificate') {
        body.category = 'site';
        body.metric = 'certificate_expiry';
        body.siteId = targetId;
        body.condition = {
          thresholdDays: certificateThresholdDays,
        };
      }
      if (targetType === 'site_certificate_asset') {
        body.category = 'site';
        body.metric = 'certificate_asset_change';
        body.siteId = targetId;
        body.condition = {
          windowHours: certificateAssetWindowHours,
        };
      }
      if (targetType === 'site_tls_renewal') {
        body.category = 'site';
        body.metric = 'tls_renewal_failure';
        body.siteId = targetId;
      }
      if (targetType === 'site_smoke_check') {
        body.category = 'site';
        body.metric = 'site_smoke_check_failure';
        body.siteId = targetId;
        body.condition = {
          windowRuns: smokeCheckWindowRuns,
          failureThreshold: Math.min(smokeCheckFailureThreshold, smokeCheckWindowRuns),
        };
      }
      if (targetType === 'resource') body.managedResourceId = targetId;
      if (targetType === 'resource_metric') {
        body.category = 'resource';
        body.metric = 'resource_metric_threshold';
        body.managedResourceId = targetId;
        body.condition = {
          metricName: resourceMetricName,
          threshold: resourceMetricThreshold,
          operator: resourceMetricOperator,
          aggregation: resourceMetricAggregation,
          windowMinutes: resourceMetricWindowMinutes,
          metricSource: 'docker_stats',
        };
      }
      if (targetType === 'backup') body.backupPlanId = targetId;
      if (targetType === 'deployment') body.projectId = targetId;
      if (targetType === 'deployment_smoke_check') {
        body.category = 'deployment';
        body.metric = 'deployment_smoke_check_failure';
        body.projectId = targetId;
        body.condition = {
          windowRuns: smokeCheckWindowRuns,
          failureThreshold: Math.min(smokeCheckFailureThreshold, smokeCheckWindowRuns),
        };
      }
      if (targetType === 'cloud_sync') {
        body.metric = 'cloud_provider_sync_failure';
        if (targetId !== 'all') body.projectId = targetId;
        body.condition = {
          provider: cloudProvider,
          windowRuns: 5,
          failureThreshold: 2,
          includeConfigFallback: false,
        };
      }
      if (targetType === 'log') {
        body.metric = 'log_error_count';
        if (targetId !== 'all') body.projectId = targetId;
        body.condition = {
          windowMinutes: 60,
          threshold: 1,
          levels: ['error', 'fatal'],
        };
      }

      await api.post('/monitoring/alert-rules', body);
      setName('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建告警规则失败');
    } finally {
      setSaving(false);
    }
  };

  const createSilence = async () => {
    if (!silenceName.trim()) {
      alert('请填写静默名称');
      return;
    }

    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + Math.max(silenceDurationMinutes, 5) * 60 * 1000);
    setSavingSilence(true);
    setError('');
    try {
      await api.post('/monitoring/silences', {
        name: silenceName.trim(),
        projectId: silenceProjectId || undefined,
        category: silenceCategory || undefined,
        severityFilter: silenceSeverityFilter,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        reason: silenceReason.trim() || undefined,
      });
      setSilenceName('');
      setSilenceProjectId('');
      setSilenceCategory('');
      setSilenceDurationMinutes(60);
      setSilenceSeverityFilter([]);
      setSilenceReason('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建静默规则失败');
    } finally {
      setSavingSilence(false);
    }
  };

  const updateSilenceStatus = async (silence: AlertSilence, status: string) => {
    setUpdatingSilenceId(silence.id);
    setError('');
    try {
      await api.put(`/monitoring/silences/${silence.id}`, { status });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新静默规则失败');
    } finally {
      setUpdatingSilenceId('');
    }
  };

  const toggleSilenceSeverity = (severityValue: string) => {
    setSilenceSeverityFilter((current) => (
      current.includes(severityValue)
        ? current.filter((item) => item !== severityValue)
        : [...current, severityValue]
    ));
  };

  const createNotificationChannel = async () => {
    const emailRecipients = channelEmailRecipients
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    const hasTarget = channelType === 'email' ? emailRecipients.length > 0 : channelWebhookUrl.trim().length > 0;
    if (!channelName.trim() || !hasTarget) {
      alert(channelType === 'email' ? '请填写通道名称和邮件收件人' : '请填写通道名称和 Webhook URL');
      return;
    }

    setSavingChannel(true);
    setError('');
    try {
      await api.post('/monitoring/notification-channels', {
        name: channelName.trim(),
        type: channelType,
        webhookUrl: channelType === 'email' ? undefined : channelWebhookUrl.trim(),
        emailRecipients: channelType === 'email' ? emailRecipients : undefined,
        emailSubjectPrefix: channelType === 'email' ? channelEmailSubjectPrefix.trim() || undefined : undefined,
        projectId: channelProjectId || undefined,
        eventStatuses: channelEventStatuses,
        severityFilter: channelSeverityFilter,
      });
      setChannelName('');
      setChannelType('webhook');
      setChannelWebhookUrl('');
      setChannelEmailRecipients('');
      setChannelEmailSubjectPrefix('Devpilot Alert');
      setChannelProjectId('');
      setChannelEventStatuses(['firing', 'error']);
      setChannelSeverityFilter([]);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建通知通道失败');
    } finally {
      setSavingChannel(false);
    }
  };

  const updateNotificationChannelStatus = async (channel: AlertNotificationChannel, status: string) => {
    setUpdatingChannelId(channel.id);
    setError('');
    try {
      await api.put(`/monitoring/notification-channels/${channel.id}`, { status });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新通知通道失败');
    } finally {
      setUpdatingChannelId('');
    }
  };

  const retryNotificationDelivery = async (delivery: AlertNotificationDelivery) => {
    setRetryingDeliveryId(delivery.id);
    setError('');
    try {
      await api.post(`/monitoring/notification-deliveries/${delivery.id}/retry`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '重试通知投递失败');
    } finally {
      setRetryingDeliveryId('');
    }
  };

  const toggleChannelEventStatus = (status: string) => {
    setChannelEventStatuses((current) => (
      current.includes(status)
        ? current.filter((item) => item !== status)
        : [...current, status]
    ));
  };

  const toggleChannelSeverity = (severityValue: string) => {
    setChannelSeverityFilter((current) => (
      current.includes(severityValue)
        ? current.filter((item) => item !== severityValue)
        : [...current, severityValue]
    ));
  };

  const evaluateRule = async (rule: AlertRule) => {
    setEvaluatingId(rule.id);
    setError('');
    try {
      await api.post(`/monitoring/alert-rules/${rule.id}/evaluate`, {});
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '评估告警规则失败');
    } finally {
      setEvaluatingId('');
    }
  };

  const acknowledgeEvent = async (event: AlertEvent) => {
    setAcknowledgingId(event.id);
    setError('');
    try {
      await api.post(`/monitoring/alert-events/${event.id}/acknowledge`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '确认告警失败');
    } finally {
      setAcknowledgingId('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">监控告警</h1>
          <p className="mt-1 text-muted-foreground">
            管理项目、环境、服务、服务器、站点和备份的告警规则与事件
          </p>
        </div>
        <button onClick={loadData} className="rounded-md border px-3 py-2 text-sm hover:bg-accent">
          刷新
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-5">
        <Metric label="规则总数" value={stats.rules} />
        <Metric label="启用中" value={stats.enabled} />
        <Metric label="触发中" value={stats.firing} />
        <Metric label="严重告警" value={stats.critical} />
        <Metric label="已静默" value={stats.suppressed} />
      </div>

      <ServiceSloDashboardPanel
        dashboard={serviceSloDashboard}
        windowMinutes={serviceSloDashboardWindow}
        targetPercent={serviceSloTargetPercent}
        loading={loadingServiceSloDashboard}
        onWindowChange={(value) => {
          setServiceSloDashboardWindow(value);
          loadServiceSloDashboard(value, serviceSloTargetPercent);
        }}
        onTargetChange={(value) => {
          setServiceSloTargetPercent(value);
          loadServiceSloDashboard(serviceSloDashboardWindow, value);
        }}
      />

      <ResourceMetricDashboardPanel
        dashboard={resourceMetricDashboard}
        windowMinutes={resourceMetricDashboardWindow}
        loading={loadingResourceMetricDashboard}
        onWindowChange={(value) => {
          setResourceMetricDashboardWindow(value);
          loadResourceMetricDashboard(value);
        }}
      />

      <div className="rounded-lg border p-4">
        <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)_minmax(180px,0.6fr)_160px_auto]">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">目标类型</span>
            <select
              value={targetType}
              onChange={(event) => {
                const nextTargetType = event.target.value as TargetType;
                setTargetType(nextTargetType);
                if (
                  nextTargetType !== 'service_slo'
                  && nextTargetType !== 'service_error_budget'
                  && nextTargetType !== 'service_error_budget_exhaustion'
                ) {
                  setSelectedSloTemplateId('');
                }
              }}
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="service">服务</option>
              <option value="service_slo">服务 SLO</option>
              <option value="service_error_budget">服务错误预算</option>
              <option value="service_error_budget_exhaustion">预算耗尽预测</option>
              <option value="server">服务器</option>
              <option value="site">站点</option>
              <option value="site_certificate">站点证书</option>
              <option value="site_certificate_asset">证书变化</option>
              <option value="site_tls_renewal">TLS 续期</option>
              <option value="site_smoke_check">Smoke 检查</option>
              <option value="resource">资源</option>
              <option value="resource_metric">资源指标</option>
              <option value="backup">备份计划</option>
              <option value="deployment">项目部署</option>
              <option value="deployment_smoke_check">部署 Smoke</option>
              <option value="cloud_sync">云同步</option>
              <option value="log">日志错误</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">目标</span>
            <select
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="">请选择目标</option>
              {targetOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          {(targetType === 'service_slo'
            || targetType === 'service_error_budget'
            || targetType === 'service_error_budget_exhaustion') && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">模板</span>
              <select
                value={selectedSloTemplateId}
                onChange={(event) => applyServiceSloTemplate(event.target.value)}
                className="w-full rounded-md border px-3 py-2"
              >
                <option value="">自定义</option>
                {serviceSloTemplates.map((template) => (
                  <option key={template.id} value={template.id} title={template.description}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {targetType === 'service_slo' && (
            <>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">策略</span>
                <select
                  value={sloRuleStrategy}
                  onChange={(event) => setSloRuleStrategy(event.target.value as 'single_window' | 'multi_window_burn_rate')}
                  className="w-full rounded-md border px-3 py-2"
                >
                  <option value="single_window">单窗口</option>
                  <option value="multi_window_burn_rate">短长窗口</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">SLO 目标 %</span>
                <input
                  type="number"
                  min={50}
                  max={99.99}
                  step={0.01}
                  value={sloRuleTargetPercent}
                  onChange={(event) => setSloRuleTargetPercent(Number(event.target.value) || 99)}
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
              {sloRuleStrategy === 'single_window' ? (
                <>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">Burn rate 阈值</span>
                    <input
                      type="number"
                      min={0.1}
                      max={100}
                      step={0.1}
                      value={sloRuleBurnRateThreshold}
                      onChange={(event) => setSloRuleBurnRateThreshold(Number(event.target.value) || 1)}
                      className="w-full rounded-md border px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">窗口分钟</span>
                    <input
                      type="number"
                      min={30}
                      max={43200}
                      value={sloRuleWindowMinutes}
                      onChange={(event) => setSloRuleWindowMinutes(Number(event.target.value) || 1440)}
                      className="w-full rounded-md border px-3 py-2"
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">短窗口分钟</span>
                    <input
                      type="number"
                      min={30}
                      max={43200}
                      value={sloRuleShortWindowMinutes}
                      onChange={(event) => setSloRuleShortWindowMinutes(Number(event.target.value) || 60)}
                      className="w-full rounded-md border px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">短 burn</span>
                    <input
                      type="number"
                      min={0.1}
                      max={100}
                      step={0.1}
                      value={sloRuleShortBurnRateThreshold}
                      onChange={(event) => setSloRuleShortBurnRateThreshold(Number(event.target.value) || 14)}
                      className="w-full rounded-md border px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">长窗口分钟</span>
                    <input
                      type="number"
                      min={30}
                      max={43200}
                      value={sloRuleLongWindowMinutes}
                      onChange={(event) => setSloRuleLongWindowMinutes(Number(event.target.value) || 360)}
                      className="w-full rounded-md border px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">长 burn</span>
                    <input
                      type="number"
                      min={0.1}
                      max={100}
                      step={0.1}
                      value={sloRuleLongBurnRateThreshold}
                      onChange={(event) => setSloRuleLongBurnRateThreshold(Number(event.target.value) || 6)}
                      className="w-full rounded-md border px-3 py-2"
                    />
                  </label>
                </>
              )}
            </>
          )}
          {targetType === 'service_error_budget' && (
            <>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">SLO 目标 %</span>
                <input
                  type="number"
                  min={50}
                  max={99.99}
                  step={0.01}
                  value={sloRuleTargetPercent}
                  onChange={(event) => setSloRuleTargetPercent(Number(event.target.value) || 99)}
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">预算阈值 %</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={sloErrorBudgetRemainingThresholdPercent}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setSloErrorBudgetRemainingThresholdPercent(Number.isFinite(value) ? value : 25);
                  }}
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">窗口分钟</span>
                <input
                  type="number"
                  min={30}
                  max={43200}
                  value={sloRuleWindowMinutes}
                  onChange={(event) => setSloRuleWindowMinutes(Number(event.target.value) || 1440)}
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
            </>
          )}
          {targetType === 'service_error_budget_exhaustion' && (
            <>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">SLO 目标 %</span>
                <input
                  type="number"
                  min={50}
                  max={99.99}
                  step={0.01}
                  value={sloRuleTargetPercent}
                  onChange={(event) => setSloRuleTargetPercent(Number(event.target.value) || 99)}
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">预计耗尽分钟</span>
                <input
                  type="number"
                  min={30}
                  max={43200}
                  value={sloErrorBudgetExhaustionWithinMinutes}
                  onChange={(event) => setSloErrorBudgetExhaustionWithinMinutes(Number(event.target.value) || 1440)}
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">窗口分钟</span>
                <input
                  type="number"
                  min={30}
                  max={43200}
                  value={sloRuleWindowMinutes}
                  onChange={(event) => setSloRuleWindowMinutes(Number(event.target.value) || 1440)}
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
            </>
          )}
          {targetType === 'cloud_sync' && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Provider</span>
              <select
                value={cloudProvider}
                onChange={(event) => setCloudProvider(event.target.value)}
                className="w-full rounded-md border px-3 py-2"
              >
                {Object.entries(cloudProviderLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          )}
          {targetType === 'site_certificate' && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">到期阈值天数</span>
              <input
                type="number"
                min={1}
                max={365}
                value={certificateThresholdDays}
                onChange={(event) => setCertificateThresholdDays(Number(event.target.value) || 14)}
                className="w-full rounded-md border px-3 py-2"
              />
            </label>
          )}
          {targetType === 'site_certificate_asset' && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">变化窗口小时</span>
              <input
                type="number"
                min={1}
                max={720}
                value={certificateAssetWindowHours}
                onChange={(event) => setCertificateAssetWindowHours(Number(event.target.value) || 24)}
                className="w-full rounded-md border px-3 py-2"
              />
            </label>
          )}
          {(targetType === 'site_smoke_check' || targetType === 'deployment_smoke_check') && (
            <>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">最近检查次数</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={smokeCheckWindowRuns}
                  onChange={(event) => setSmokeCheckWindowRuns(Number(event.target.value) || 3)}
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">失败阈值</span>
                <input
                  type="number"
                  min={1}
                  max={smokeCheckWindowRuns}
                  value={smokeCheckFailureThreshold}
                  onChange={(event) => setSmokeCheckFailureThreshold(Number(event.target.value) || 1)}
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
            </>
          )}
          {targetType === 'resource_metric' && (
            <>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">指标</span>
                <select
                  value={resourceMetricName}
                  onChange={(event) => setResourceMetricName(event.target.value)}
                  className="w-full rounded-md border px-3 py-2"
                >
                  {Object.entries(resourceMetricLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">聚合</span>
                <select
                  value={resourceMetricAggregation}
                  onChange={(event) => setResourceMetricAggregation(event.target.value)}
                  className="w-full rounded-md border px-3 py-2"
                >
                  {Object.entries(resourceMetricAggregationLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">比较</span>
                <select
                  value={resourceMetricOperator}
                  onChange={(event) => setResourceMetricOperator(event.target.value)}
                  className="w-full rounded-md border px-3 py-2"
                >
                  {Object.entries(resourceMetricOperatorLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">阈值</span>
                <input
                  type="number"
                  min={0}
                  value={resourceMetricThreshold}
                  onChange={(event) => setResourceMetricThreshold(Number(event.target.value) || 0)}
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">窗口分钟</span>
                <input
                  type="number"
                  min={1}
                  value={resourceMetricWindowMinutes}
                  onChange={(event) => setResourceMetricWindowMinutes(Number(event.target.value) || 15)}
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
            </>
          )}
          <label className="block text-sm">
            <span className="mb-1 block font-medium">名称</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={defaultRuleName(targetType)}
              className="w-full rounded-md border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">级别</span>
            <select
              value={severity}
              onChange={(event) => setSeverity(event.target.value as 'info' | 'warning' | 'critical')}
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="info">提示</option>
              <option value="warning">警告</option>
              <option value="critical">严重</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">评估方式</span>
            <select
              value={evaluationMode}
              onChange={(event) => setEvaluationMode(event.target.value as 'manual' | 'schedule')}
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="manual">手动</option>
              <option value="schedule">定时</option>
            </select>
          </label>
          {evaluationMode === 'schedule' && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">间隔秒</span>
              <input
                type="number"
                min={30}
                value={intervalSeconds}
                onChange={(event) => setIntervalSeconds(Number(event.target.value) || 300)}
                className="w-full rounded-md border px-3 py-2"
              />
            </label>
          )}
          <div className="flex items-end">
            <button
              onClick={createRule}
              disabled={saving || !targetId}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              {saving ? '创建中...' : '创建规则'}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">告警静默</h2>
          <Badge className="bg-blue-100 text-blue-700">{silences.length} 条规则</Badge>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[180px_180px_160px_140px_minmax(220px,0.8fr)_minmax(220px,1fr)_120px]">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">名称</span>
            <input
              value={silenceName}
              onChange={(event) => setSilenceName(event.target.value)}
              placeholder="维护窗口"
              className="w-full rounded-md border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">项目</span>
            <select
              value={silenceProjectId}
              onChange={(event) => setSilenceProjectId(event.target.value)}
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="">全部项目</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">分类</span>
            <select
              value={silenceCategory}
              onChange={(event) => setSilenceCategory(event.target.value)}
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="">全部分类</option>
              {['service', 'server', 'site', 'resource', 'backup', 'deployment', 'log'].map((category) => (
                <option key={category} value={category}>{categoryLabels[category] || category}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">持续分钟</span>
            <input
              type="number"
              min={5}
              value={silenceDurationMinutes}
              onChange={(event) => setSilenceDurationMinutes(Number(event.target.value) || 60)}
              className="w-full rounded-md border px-3 py-2"
            />
          </label>
          <div className="text-sm">
            <span className="mb-2 block font-medium">级别</span>
            <div className="flex flex-wrap gap-2">
              {['info', 'warning', 'critical'].map((severityValue) => (
                <label key={severityValue} className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={silenceSeverityFilter.includes(severityValue)}
                    onChange={() => toggleSilenceSeverity(severityValue)}
                  />
                  <span>{severityLabels[severityValue] || severityValue}</span>
                </label>
              ))}
            </div>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">原因</span>
            <input
              value={silenceReason}
              onChange={(event) => setSilenceReason(event.target.value)}
              placeholder="发布、扩容或维护"
              className="w-full rounded-md border px-3 py-2"
            />
          </label>
          <div className="flex items-end">
            <button
              onClick={createSilence}
              disabled={savingSilence || !silenceName.trim()}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              {savingSilence ? '创建中...' : '创建静默'}
            </button>
          </div>
        </div>

        <div className="mt-4 divide-y border-t">
          {silences.length === 0 ? (
            <div className="py-6 text-sm text-muted-foreground">暂无静默规则</div>
          ) : silences.slice(0, 6).map((silence) => (
            <div key={silence.id} className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{silence.name}</span>
                    <Badge className={statusClasses[displaySilenceStatus(silence)] || 'bg-gray-100 text-gray-700'}>
                      {statusLabels[displaySilenceStatus(silence)] || displaySilenceStatus(silence)}
                    </Badge>
                    {silence.category && (
                      <Badge className="bg-gray-100 text-gray-700">{categoryLabels[silence.category] || silence.category}</Badge>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatProjectName(silence.projectId, projects)} · {formatSeverityList(silence.severityFilter)} · {formatSilenceWindow(silence)}
                  </div>
                  {silence.reason && (
                    <div className="mt-1 text-xs text-muted-foreground">{silence.reason}</div>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  {silence.status === 'active' ? (
                    <button
                      onClick={() => updateSilenceStatus(silence, 'paused')}
                      disabled={Boolean(updatingSilenceId)}
                      className="rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
                    >
                      {updatingSilenceId === silence.id ? '处理中...' : '暂停'}
                    </button>
                  ) : (
                    <button
                      onClick={() => updateSilenceStatus(silence, 'active')}
                      disabled={Boolean(updatingSilenceId)}
                      className="rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
                    >
                      {updatingSilenceId === silence.id ? '处理中...' : '启用'}
                    </button>
                  )}
                  <button
                    onClick={() => updateSilenceStatus(silence, 'archived')}
                    disabled={Boolean(updatingSilenceId)}
                    className="rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
                  >
                    归档
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">告警通知</h2>
          <Badge className="bg-blue-100 text-blue-700">{channels.length} 个通道</Badge>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[160px_180px_minmax(220px,1fr)_180px_minmax(180px,0.7fr)_180px_minmax(260px,0.8fr)_minmax(220px,0.7fr)_120px]">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">通道名称</span>
            <input
              value={channelName}
              onChange={(event) => setChannelName(event.target.value)}
              placeholder={notificationChannelTypeLabels[channelType] || '通知通道'}
              className="w-full rounded-md border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">通道类型</span>
            <select
              value={channelType}
              onChange={(event) => setChannelType(event.target.value as typeof channelType)}
              className="w-full rounded-md border px-3 py-2"
            >
              {Object.entries(notificationChannelTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{channelType === 'email' ? '邮件收件人' : '机器人 Webhook URL'}</span>
            <input
              value={channelType === 'email' ? channelEmailRecipients : channelWebhookUrl}
              onChange={(event) => (
                channelType === 'email'
                  ? setChannelEmailRecipients(event.target.value)
                  : setChannelWebhookUrl(event.target.value)
              )}
              placeholder={notificationChannelTargetPlaceholders[channelType] || notificationChannelTargetPlaceholders.webhook}
              className="w-full rounded-md border px-3 py-2"
            />
          </label>
          {channelType === 'email' && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">主题前缀</span>
              <input
                value={channelEmailSubjectPrefix}
                onChange={(event) => setChannelEmailSubjectPrefix(event.target.value)}
                placeholder="Devpilot Alert"
                className="w-full rounded-md border px-3 py-2"
              />
            </label>
          )}
          <label className="block text-sm">
            <span className="mb-1 block font-medium">项目</span>
            <select
              value={channelProjectId}
              onChange={(event) => setChannelProjectId(event.target.value)}
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="">全部项目</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
          <div className="text-sm">
            <span className="mb-2 block font-medium">事件状态</span>
            <div className="flex flex-wrap gap-2">
              {['firing', 'error', 'insufficient_data', 'resolved'].map((status) => (
                <label key={status} className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={channelEventStatuses.includes(status)}
                    onChange={() => toggleChannelEventStatus(status)}
                  />
                  <span>{statusLabels[status] || status}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="text-sm">
            <span className="mb-2 block font-medium">级别</span>
            <div className="flex flex-wrap gap-2">
              {['info', 'warning', 'critical'].map((severityValue) => (
                <label key={severityValue} className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={channelSeverityFilter.includes(severityValue)}
                    onChange={() => toggleChannelSeverity(severityValue)}
                  />
                  <span>{severityLabels[severityValue] || severityValue}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-end xl:col-start-8">
            <button
              onClick={createNotificationChannel}
              disabled={
                savingChannel ||
                !channelName.trim() ||
                (channelType === 'email' ? !channelEmailRecipients.trim() : !channelWebhookUrl.trim())
              }
              className="w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              {savingChannel ? '创建中...' : '创建通道'}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-5 border-t pt-4 xl:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium">通知通道</h3>
            <div className="mt-2 divide-y">
              {channels.length === 0 ? (
                <div className="py-6 text-sm text-muted-foreground">暂无通知通道</div>
              ) : channels.slice(0, 6).map((channel) => (
                <div key={channel.id} className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{channel.name}</span>
                        <Badge className={statusClasses[channel.status] || 'bg-gray-100 text-gray-700'}>
                          {statusLabels[channel.status] || channel.status}
                        </Badge>
                        {channel.lastStatus && (
                          <Badge className={statusClasses[channel.lastStatus] || 'bg-gray-100 text-gray-700'}>
                            {statusLabels[channel.lastStatus] || channel.lastStatus}
                          </Badge>
                        )}
                        <Badge className="bg-blue-100 text-blue-700">
                          {notificationChannelTypeLabels[channel.type] || channel.type}
                        </Badge>
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {channel.config?.target || '-'} · {formatProjectName(channel.projectId, projects)}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        状态：{formatStatusList(channel.eventStatuses)} · 级别：{formatSeverityList(channel.severityFilter)}
                      </div>
                      {channel.lastError && (
                        <div className="mt-1 text-xs text-red-600">{channel.lastError}</div>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {channel.status === 'active' ? (
                        <button
                          onClick={() => updateNotificationChannelStatus(channel, 'paused')}
                          disabled={Boolean(updatingChannelId)}
                          className="rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
                        >
                          {updatingChannelId === channel.id ? '处理中...' : '暂停'}
                        </button>
                      ) : (
                        <button
                          onClick={() => updateNotificationChannelStatus(channel, 'active')}
                          disabled={Boolean(updatingChannelId)}
                          className="rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
                        >
                          {updatingChannelId === channel.id ? '处理中...' : '启用'}
                        </button>
                      )}
                      <button
                        onClick={() => updateNotificationChannelStatus(channel, 'archived')}
                        disabled={Boolean(updatingChannelId)}
                        className="rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
                      >
                        归档
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium">最近投递</h3>
            <div className="mt-2 divide-y">
              {deliveries.length === 0 ? (
                <div className="py-6 text-sm text-muted-foreground">暂无投递记录</div>
              ) : deliveries.slice(0, 6).map((delivery) => (
                <div key={delivery.id} className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{delivery.channel?.name || delivery.channelId}</span>
                        <Badge className={statusClasses[delivery.status] || 'bg-gray-100 text-gray-700'}>
                          {statusLabels[delivery.status] || delivery.status}
                        </Badge>
                        {delivery.dryRun && <Badge className="bg-blue-100 text-blue-700">dry run</Badge>}
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {delivery.alertEvent?.rule?.name || delivery.alertEvent?.summary || delivery.alertEventId}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {delivery.target || '-'} · {formatDate(delivery.attemptedAt || delivery.createdAt)}
                      </div>
                      {delivery.error && (
                        <div className="mt-1 text-xs text-red-600">{delivery.error}</div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {delivery.responseStatus && (
                        <Badge className={delivery.responseStatus < 400 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          HTTP {delivery.responseStatus}
                        </Badge>
                      )}
                      {['failed', 'planned'].includes(delivery.status) && (
                        <button
                          onClick={() => retryNotificationDelivery(delivery)}
                          disabled={Boolean(retryingDeliveryId)}
                          className="rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
                        >
                          {retryingDeliveryId === delivery.id ? '重试中...' : '重试'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">加载中...</div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
          <div className="space-y-4">
            {rules.length === 0 ? (
              <div className="rounded-lg border py-12 text-center">
                <h3 className="text-lg font-medium">暂无告警规则</h3>
                <p className="mt-2 text-muted-foreground">
                  创建规则后可以手动评估，并把结果写入告警事件和审计事件
                </p>
              </div>
            ) : rules.map((rule) => (
              <div key={rule.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{rule.name}</h3>
                      <Badge className={severityClasses[rule.severity] || 'bg-gray-100 text-gray-700'}>
                        {severityLabels[rule.severity] || rule.severity}
                      </Badge>
                      {rule.lastStatus && (
                        <Badge className={statusClasses[rule.lastStatus] || 'bg-gray-100 text-gray-700'}>
                          {statusLabels[rule.lastStatus] || rule.lastStatus}
                        </Badge>
                      )}
                      {!rule.enabled && <Badge className="bg-gray-100 text-gray-700">停用</Badge>}
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {categoryLabels[rule.category] || rule.category} · {metricLabels[rule.metric] || rule.metric}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      目标：{formatRuleTarget(rule)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      项目：{rule.project?.name || '未关联'} · 环境：{rule.environment?.name || rule.environment?.key || '未关联'} · {formatEvaluationMode(rule)} · 最近评估：{formatDate(rule.lastEvaluatedAt)}
                    </div>
                    {rule.lastMessage && (
                      <div className="mt-2 rounded-md bg-muted/50 p-2 text-sm">
                        {rule.lastMessage}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => evaluateRule(rule)}
                    disabled={Boolean(evaluatingId) || !rule.enabled}
                    className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
                  >
                    {evaluatingId === rule.id ? '评估中...' : '手动评估'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border">
            <div className="border-b px-4 py-3">
              <h2 className="font-medium">最近告警事件</h2>
            </div>
            <div className="divide-y">
              {events.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  暂无告警事件
                </div>
              ) : events.slice(0, 15).map((event) => (
                <div key={event.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {event.rule?.name || event.summary || event.id}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {categoryLabels[event.category] || event.category} · {metricLabels[event.metric] || event.metric}
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Badge className={severityClasses[event.severity] || 'bg-gray-100 text-gray-700'}>
                        {severityLabels[event.severity] || event.severity}
                      </Badge>
                      <Badge className={statusClasses[event.status] || 'bg-gray-100 text-gray-700'}>
                        {statusLabels[event.status] || event.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {formatEventTarget(event)} · {formatDate(event.occurredAt)}
                  </div>
                  {event.summary && (
                    <div className="mt-2 rounded-md bg-muted/50 px-2 py-1 text-xs">
                      {event.summary}
                    </div>
                  )}
                  {event.status === 'firing' && (
                    <button
                      onClick={() => acknowledgeEvent(event)}
                      disabled={Boolean(acknowledgingId)}
                      className="mt-3 rounded-md border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
                    >
                      {acknowledgingId === event.id ? '确认中...' : '确认'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

const serviceSloDashboardWindowOptions = [
  { value: '360', label: '6 小时' },
  { value: '1440', label: '24 小时' },
  { value: '10080', label: '7 天' },
  { value: '43200', label: '30 天' },
];

const serviceSloTargetOptions = [
  { value: '99.9', label: '99.9%' },
  { value: '99', label: '99%' },
  { value: '95', label: '95%' },
];

const resourceMetricDashboardWindowOptions = [
  { value: '60', label: '1 小时' },
  { value: '360', label: '6 小时' },
  { value: '1440', label: '24 小时' },
  { value: '10080', label: '7 天' },
];

function ServiceSloDashboardPanel({
  dashboard,
  windowMinutes,
  targetPercent,
  loading,
  onWindowChange,
  onTargetChange,
}: {
  dashboard: ServiceSloDashboard | null;
  windowMinutes: string;
  targetPercent: string;
  loading: boolean;
  onWindowChange: (value: string) => void;
  onTargetChange: (value: string) => void;
}) {
  return (
    <section className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">服务 SLO 总览</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {dashboard
              ? `${formatMetricWindow(dashboard.windowMinutes)} · 目标 ${formatPercent(dashboard.targetPercent)} · 更新 ${formatDate(dashboard.generatedAt)}`
              : '暂无服务 SLO 信号'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={windowMinutes}
            onChange={(event) => onWindowChange(event.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
            aria-label="服务 SLO 窗口"
          >
            {serviceSloDashboardWindowOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            value={targetPercent}
            onChange={(event) => onTargetChange(event.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
            aria-label="服务 SLO 目标"
          >
            {serviceSloTargetOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 rounded-md bg-muted/40 px-3 py-8 text-center text-sm text-muted-foreground">
          加载服务 SLO...
        </div>
      ) : dashboard && dashboard.serviceCount > 0 ? (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
            <DashboardStat label="服务数" value={dashboard.serviceCount} detail={`${dashboard.okCount} 达标`} />
            <DashboardStat label="平均 SLO" value={formatPercent(dashboard.averageSloPercent)} />
            <DashboardStat label="预警" value={dashboard.warningCount} tone={dashboard.warningCount > 0 ? 'warn' : 'muted'} />
            <DashboardStat label="严重" value={dashboard.criticalCount} tone={dashboard.criticalCount > 0 ? 'critical' : 'muted'} />
            <DashboardStat label="暂无数据" value={dashboard.noDataCount} />
            <DashboardStat label="部署失败" value={`${dashboard.deploymentFailureCount}/${dashboard.deploymentCount}`} tone={dashboard.deploymentFailureCount > 0 ? 'warn' : 'muted'} />
            <DashboardStat label="操作失败" value={`${dashboard.operationFailureCount}/${dashboard.operationCount}`} tone={dashboard.operationFailureCount > 0 ? 'warn' : 'muted'} />
            <DashboardStat label="告警影响" value={dashboard.alertImpactCount} tone={dashboard.alertImpactCount > 0 ? 'critical' : 'muted'} />
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-3 py-2 text-left font-medium">服务</th>
                  <th className="px-3 py-2 text-left font-medium">状态</th>
                  <th className="px-3 py-2 text-left font-medium">SLO</th>
                  <th className="px-3 py-2 text-left font-medium">错误预算</th>
                  <th className="px-3 py-2 text-left font-medium">部署</th>
                  <th className="px-3 py-2 text-left font-medium">操作</th>
                  <th className="px-3 py-2 text-left font-medium">告警</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {dashboard.rows.slice(0, 6).map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-3">
                      <div className="font-medium">{row.service.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {row.service.project?.name || '未关联项目'} · {row.service.environment?.name || row.service.environment?.key || '未关联环境'} · {row.service.kind}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1">
                        <Badge className={statusClasses[row.status] || 'bg-gray-100 text-gray-700'}>
                          {statusLabels[row.status] || row.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{row.statusReason}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <DashboardMetricCell value={formatPercent(row.sloPercent)} detail={`目标 ${formatPercent(row.targetPercent)}`} />
                    </td>
                    <td className="px-3 py-3">
                      <DashboardMetricCell value={formatPercent(row.errorBudgetRemainingPercent)} detail={`burn ${formatMetricNumber(row.burnRate)}`} />
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {row.deploymentSuccessCount} 成功 / {row.deploymentFailureCount} 失败
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {row.operationSuccessCount} 成功 / {row.operationFailureCount} 失败
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {row.alertImpactCount} 影响 · {row.criticalAlertCount} 严重
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-md bg-muted/40 px-3 py-8 text-center text-sm text-muted-foreground">
          暂无服务 SLO 信号
        </div>
      )}
    </section>
  );
}

function ResourceMetricDashboardPanel({
  dashboard,
  windowMinutes,
  loading,
  onWindowChange,
}: {
  dashboard: ResourceMetricDashboard | null;
  windowMinutes: string;
  loading: boolean;
  onWindowChange: (value: string) => void;
}) {
  return (
    <section className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">资源指标总览</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {dashboard
              ? `${formatMetricWindow(dashboard.windowMinutes)} · ${dashboard.sampleCount} 个样本 · 更新 ${formatDate(dashboard.generatedAt)}`
              : '暂无资源指标样本'}
          </p>
        </div>
        <select
          value={windowMinutes}
          onChange={(event) => onWindowChange(event.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm"
          aria-label="资源指标窗口"
        >
          {resourceMetricDashboardWindowOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="mt-4 rounded-md bg-muted/40 px-3 py-8 text-center text-sm text-muted-foreground">
          加载资源指标...
        </div>
      ) : dashboard && dashboard.resourceCount > 0 ? (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-7">
            <DashboardStat label="覆盖资源" value={dashboard.resourceCount} detail={`${dashboard.okCount} 正常`} />
            <DashboardStat label="预警" value={dashboard.warningCount} tone={dashboard.warningCount > 0 ? 'warn' : 'muted'} />
            <DashboardStat label="严重" value={dashboard.criticalCount} tone={dashboard.criticalCount > 0 ? 'critical' : 'muted'} />
            <DashboardStat label="样本过期" value={dashboard.staleCount} tone={dashboard.staleCount > 0 ? 'warn' : 'muted'} />
            <DashboardStat label="CPU 峰值" value={formatPercent(dashboard.maxCpuPercent)} />
            <DashboardStat label="内存峰值" value={formatPercent(dashboard.maxMemoryPercent)} />
            <DashboardStat label="PIDs 峰值" value={formatMetricNumber(dashboard.maxPids)} />
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-3 py-2 text-left font-medium">资源</th>
                  <th className="px-3 py-2 text-left font-medium">状态</th>
                  <th className="px-3 py-2 text-left font-medium">CPU</th>
                  <th className="px-3 py-2 text-left font-medium">内存</th>
                  <th className="px-3 py-2 text-left font-medium">PIDs</th>
                  <th className="px-3 py-2 text-left font-medium">样本</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {dashboard.rows.slice(0, 6).map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-3">
                      <div className="font-medium">{row.resource?.name || row.resourceId}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {row.resource?.project?.name || '未关联项目'} · {row.resource?.environment?.name || row.resource?.environment?.key || '未关联环境'} · {row.provider}/{row.kind}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1">
                        <Badge className={statusClasses[row.status] || 'bg-gray-100 text-gray-700'}>
                          {statusLabels[row.status] || row.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{row.statusReason}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <DashboardMetricCell value={formatPercent(row.cpuPercent.latest)} detail={`max ${formatPercent(row.cpuPercent.max)}`} />
                    </td>
                    <td className="px-3 py-3">
                      <DashboardMetricCell value={formatPercent(row.memoryPercent.latest)} detail={formatBytes(row.memoryUsageBytes.latest)} />
                    </td>
                    <td className="px-3 py-3">
                      <DashboardMetricCell value={formatMetricNumber(row.pids.latest)} detail={`max ${formatMetricNumber(row.pids.max)}`} />
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {row.sampleCount} 个 · {formatDate(row.lastSampledAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-md bg-muted/40 px-3 py-8 text-center text-sm text-muted-foreground">
          暂无资源指标样本
        </div>
      )}
    </section>
  );
}

function DashboardStat({
  label,
  value,
  detail,
  tone = 'muted',
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: 'muted' | 'warn' | 'critical';
}) {
  const toneClass = tone === 'critical'
    ? 'text-red-700'
    : (tone === 'warn' ? 'text-yellow-700' : '');
  return (
    <div className="min-w-0 rounded-md bg-muted/40 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 truncate text-lg font-semibold ${toneClass}`} title={String(value)}>{value}</div>
      {detail && <div className="mt-1 truncate text-xs text-muted-foreground">{detail}</div>}
    </div>
  );
}

function DashboardMetricCell({ value, detail }: { value: string; detail: string }) {
  return (
    <div>
      <div className="font-medium">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function Badge({ children, className }: { children: string | number | Array<string | number>; className: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

function formatTargetType(targetType: TargetType) {
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

function defaultRuleName(targetType: TargetType) {
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

function formatRuleTarget(rule: AlertRule) {
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

function formatEventTarget(event: AlertEvent) {
  if (event.metric === 'service_slo_breach') {
    return event.applicationService?.name ? `${event.applicationService.name} SLO` : '服务 SLO';
  }
  if (event.metric === 'service_error_budget') {
    return event.applicationService?.name ? `${event.applicationService.name} 错误预算` : '服务错误预算';
  }
  if (event.metric === 'service_error_budget_exhaustion') {
    return event.applicationService?.name ? `${event.applicationService.name} 预算耗尽预测` : '错误预算耗尽预测';
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

function formatCertificateExpiryCondition(value?: Record<string, unknown> | null) {
  if (!value) return '默认 14 天';
  const thresholdDays = typeof value.thresholdDays === 'number' ? value.thresholdDays : 14;
  return `${thresholdDays} 天内到期`;
}

function formatCertificateAssetChangeCondition(value?: Record<string, unknown> | null) {
  if (!value) return '最近 24 小时';
  const windowHours = typeof value.windowHours === 'number' ? value.windowHours : 24;
  return `最近 ${windowHours} 小时变化`;
}

function formatSmokeCheckCondition(value?: Record<string, unknown> | null) {
  if (!value) return '最近 3 次失败 >= 1';
  const windowRuns = typeof value.windowRuns === 'number' ? value.windowRuns : 3;
  const failureThreshold = typeof value.failureThreshold === 'number' ? value.failureThreshold : 1;
  return `最近 ${windowRuns} 次失败 >= ${failureThreshold}`;
}

function formatResourceMetricCondition(value?: Record<string, unknown> | null) {
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

function formatServiceSloCondition(value?: Record<string, unknown> | null) {
  if (!value) return '目标 99% · 24 小时';
  const windows = Array.isArray(value.windows)
    ? value.windows
      .map((item) => (item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : null))
      .filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
  if (windows.length > 0) {
    const targetPercent = typeof value.targetPercent === 'number' ? value.targetPercent : 99;
    const policy = value.matchPolicy === 'all' ? '全部窗口' : '任一窗口';
    const windowLabels = windows.map((window, index) => {
      const label = typeof window.label === 'string' && window.label.trim() ? window.label.trim() : `窗口 ${index + 1}`;
      const windowMinutes = typeof window.windowMinutes === 'number' ? window.windowMinutes : (index === 0 ? 60 : 360);
      const burnRateThreshold = typeof window.burnRateThreshold === 'number' ? window.burnRateThreshold : 1;
      return `${label} ${formatMetricWindow(windowMinutes)} burn ${burnRateThreshold}`;
    });
    return `目标 ${formatPercent(targetPercent)} · ${windowLabels.join(' / ')} · ${policy}`;
  }
  const targetPercent = typeof value.targetPercent === 'number' ? value.targetPercent : 99;
  const burnRateThreshold = typeof value.burnRateThreshold === 'number' ? value.burnRateThreshold : 1;
  const windowMinutes = typeof value.windowMinutes === 'number' ? value.windowMinutes : 1440;
  return `目标 ${formatPercent(targetPercent)} · burn ${burnRateThreshold} · ${formatMetricWindow(windowMinutes)}`;
}

function formatServiceErrorBudgetCondition(value?: Record<string, unknown> | null) {
  if (!value) return '目标 99% · 剩余 <= 25% · 24 小时';
  const targetPercent = typeof value.targetPercent === 'number' ? value.targetPercent : 99;
  const threshold = typeof value.remainingThresholdPercent === 'number' ? value.remainingThresholdPercent : 25;
  const windowMinutes = typeof value.windowMinutes === 'number' ? value.windowMinutes : 1440;
  return `目标 ${formatPercent(targetPercent)} · 剩余 <= ${formatPercent(threshold)} · ${formatMetricWindow(windowMinutes)}`;
}

function formatServiceErrorBudgetExhaustionCondition(value?: Record<string, unknown> | null) {
  if (!value) return '目标 99% · 24 小时内耗尽 · 24 小时';
  const targetPercent = typeof value.targetPercent === 'number' ? value.targetPercent : 99;
  const exhaustionWithinMinutes = typeof value.exhaustionWithinMinutes === 'number'
    ? value.exhaustionWithinMinutes
    : 1440;
  const windowMinutes = typeof value.windowMinutes === 'number' ? value.windowMinutes : 1440;
  return `目标 ${formatPercent(targetPercent)} · ${formatMetricWindow(exhaustionWithinMinutes)}内耗尽 · ${formatMetricWindow(windowMinutes)}`;
}

function formatEvaluationMode(rule: AlertRule) {
  if (rule.evaluationMode === 'schedule') {
    return `定时评估 ${rule.intervalSeconds || 300}s`;
  }
  return '手动评估';
}

function formatProjectName(projectId: string | null | undefined, projects: Project[]) {
  if (!projectId) return '全部项目';
  return projects.find((project) => project.id === projectId)?.name || projectId;
}

function displaySilenceStatus(silence: AlertSilence) {
  if (silence.status !== 'active') return silence.status;
  if (silence.endsAt && new Date(silence.endsAt).getTime() <= Date.now()) return 'expired';
  return silence.status;
}

function formatSilenceWindow(silence: AlertSilence) {
  return `${formatDate(silence.startsAt)} - ${silence.endsAt ? formatDate(silence.endsAt) : '长期'}`;
}

function formatStatusList(statuses?: string[] | null) {
  const values = statuses && statuses.length > 0 ? statuses : ['firing', 'error'];
  return values.map((status) => statusLabels[status] || status).join('、');
}

function formatSeverityList(severities?: string[] | null) {
  if (!severities || severities.length === 0) return '全部';
  return severities.map((severity) => severityLabels[severity] || severity).join('、');
}

function formatPercent(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
}

function formatMetricNumber(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatBytes(value?: number | null) {
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

function formatMetricWindow(minutes: number) {
  if (!Number.isFinite(minutes)) return '-';
  if (minutes >= 1440) return `${Math.round(minutes / 1440)} 天`;
  if (minutes >= 60) return `${Math.round(minutes / 60)} 小时`;
  return `${minutes} 分钟`;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
