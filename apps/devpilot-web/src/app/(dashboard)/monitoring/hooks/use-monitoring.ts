/**
 * 监控数据 Hook
 *
 * 单一职责：组合状态、加载全部监控数据（规则/事件/静默/通道/仪表盘）。
 */

import { useEffect, useMemo, useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import type {
  Project,
  ApplicationItem,
  Server,
  Site,
  ManagedResource,
  BackupPlan,
  AlertRule,
  AlertEvent,
  AlertSilence,
  AlertNotificationChannel,
  AlertNotificationDelivery,
} from '../types';
import type { ResourceMetricDashboard, ServiceSloDashboard } from '../types-dashboard';
import { useMonitoringActions } from './use-monitoring-actions';

interface UseMonitoringOptions {
  applicationServiceId?: string;
}

interface ServiceSloDashboardQuery {
  windowMinutes: number;
  limit: number;
  applicationServiceId?: string;
}

function buildServiceSloDashboardQuery(
  applicationServiceId: string,
  windowMinutes: number,
): ServiceSloDashboardQuery {
  const query: ServiceSloDashboardQuery = {
    windowMinutes,
    limit: applicationServiceId ? 5 : 20,
  };
  if (applicationServiceId) query.applicationServiceId = applicationServiceId;
  return query;
}

export function useMonitoring(options: UseMonitoringOptions = {}) {
  const applicationServiceId = options.applicationServiceId?.trim() || '';
  const [projects, setProjects] = useState<Project[]>([]);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [resources, setResources] = useState<ManagedResource[]>([]);
  const [backupPlans, setBackupPlans] = useState<BackupPlan[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [silences, setSilences] = useState<AlertSilence[]>([]);
  const [notificationChannels, setNotificationChannels] = useState<AlertNotificationChannel[]>([]);
  const [notificationDeliveries, setNotificationDeliveries] = useState<AlertNotificationDelivery[]>(
    [],
  );
  const [resourceMetricDashboard, setResourceMetricDashboard] =
    useState<ResourceMetricDashboard | null>(null);
  const [serviceSloDashboard, setServiceSloDashboard] = useState<ServiceSloDashboard | null>(null);
  const [resourceMetricDashboardWindow, setResourceMetricDashboardWindow] = useState(60);
  const [serviceSloDashboardWindow, setServiceSloDashboardWindow] = useState(60);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState('');
  const [error, setError] = useState('');
  const [creatingRule, setCreatingRule] = useState(false);
  const [creatingSilence, setCreatingSilence] = useState(false);
  const [creatingChannel, setCreatingChannel] = useState(false);

  const loadData = usePersistFn(async () => {
    setError('');
    try {
      const [
        rulesData,
        eventsData,
        silData,
        chanData,
        projData,
        appData,
        srvData,
        siteData,
        resData,
        bkData,
        serviceSloData,
      ] = await Promise.all([
        apiRequest<AlertRule[]>('GET:/monitoring/alert-rules'),
        apiRequest<AlertEvent[]>('GET:/monitoring/alert-events'),
        apiRequest<AlertSilence[]>('GET:/monitoring/silences'),
        apiRequest<AlertNotificationChannel[]>('GET:/monitoring/notification-channels'),
        apiRequest<Project[]>('GET:/projects'),
        apiRequest<ApplicationItem[]>('GET:/applications'),
        apiRequest<Server[]>('GET:/servers'),
        apiRequest<Site[]>('GET:/sites'),
        apiRequest<ManagedResource[]>('GET:/resource-control/resources'),
        apiRequest<BackupPlan[]>('GET:/backups/plans'),
        apiRequest<ServiceSloDashboard>(
          'GET:/monitoring/service-slo/dashboard',
          buildServiceSloDashboardQuery(applicationServiceId, serviceSloDashboardWindow),
        ),
      ]);
      setRules(rulesData);
      setEvents(eventsData);
      setSilences(silData);
      setNotificationChannels(chanData);
      setProjects(projData);
      setApplications(appData);
      setServers(srvData);
      setSites(siteData);
      setResources(resData);
      setBackupPlans(bkData);
      setServiceSloDashboard(serviceSloData);
    } catch (err) {
      setServiceSloDashboard(null);
      setError(err instanceof Error ? err.message : '加载监控数据失败');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    loadData();
  }, [applicationServiceId, loadData, serviceSloDashboardWindow]);

  const actions = useMonitoringActions({
    rules,
    setRules,
    events,
    setEvents,
    silences,
    setSilences,
    notificationChannels,
    setNotificationChannels,
    notificationDeliveries,
    setNotificationDeliveries,
    setError,
    setActingId,
    setCreatingRule,
    setCreatingSilence,
    setCreatingChannel,
    loadData,
  });

  const selectedApplicationService = useMemo(() => {
    if (!applicationServiceId) return null;
    for (const application of applications) {
      const service = application.services.find((item) => item.id === applicationServiceId);
      if (service) return { application, service };
    }
    return null;
  }, [applications, applicationServiceId]);

  return {
    applicationServiceId,
    selectedApplicationService,
    projects,
    applications,
    servers,
    sites,
    resources,
    backupPlans,
    rules,
    events,
    silences,
    notificationChannels,
    notificationDeliveries,
    resourceMetricDashboard,
    serviceSloDashboard,
    resourceMetricDashboardWindow,
    setResourceMetricDashboardWindow,
    serviceSloDashboardWindow,
    setServiceSloDashboardWindow,
    loading,
    actingId,
    error,
    creatingRule,
    creatingSilence,
    creatingChannel,
    loadData,
    ...actions,
  };
}
