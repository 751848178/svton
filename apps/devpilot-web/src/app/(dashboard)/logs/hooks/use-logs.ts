/**
 * 日志中心数据 Hook
 *
 * 单一职责：组合状态、加载全部日志数据、提供流 CRUD 与基本操作。
 * SSE 流式 Tail 与策略保存委托 use-logs-tail、use-logs-policies。
 */

import { useEffect, useMemo } from 'react';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { useLogsState } from './use-logs-state';
import { useLogsTailState } from './use-logs-tail-state';
import { useLogsTail } from './use-logs-tail';
import { useLogsPolicies } from './use-logs-policies';
import { sourceTypeForTarget, formatTargetType } from '../utils';
import type { LogStream } from '../types-stream';
import type { TargetType, ManagedResource } from '../types';

export function useLogs() {
  const s = useLogsState();
  const t = useLogsTailState();

  const services = useMemo(
    () =>
      s.applications.flatMap((app) =>
        app.services.map((svc) => ({
          ...svc,
          applicationName: app.name,
          projectName: app.project?.name,
        })),
      ),
    [s.applications],
  );

  const targetOptions = useMemo(() => {
    if (s.targetType === 'service')
      return services.map((svc) => ({
        id: svc.id,
        label: `${svc.applicationName} / ${svc.name} · ${svc.status}`,
      }));
    if (s.targetType === 'server')
      return s.servers.map((srv) => ({
        id: srv.id,
        label: `${srv.name} (${srv.host}) · ${srv.status}`,
      }));
    if (s.targetType === 'site')
      return s.sites.map((st) => ({ id: st.id, label: `${st.name} · ${st.primaryDomain}` }));
    if (s.targetType === 'resource')
      return s.resources.map((r) => ({ id: r.id, label: `${r.name} (${r.provider}/${r.kind})` }));
    if (s.targetType === 'backup')
      return s.backupPlans.map((b) => ({ id: b.id, label: `${b.name} · ${b.backupType}` }));
    if (s.targetType === 'alert')
      return s.alertEvents.map((a) => ({ id: a.id, label: `${a.metric} · ${a.severity}` }));
    if (s.targetType === 'deployment')
      return s.deploymentRuns.map((d) => ({ id: d.id, label: `${d.source} · ${d.status}` }));
    return s.projects.map((p) => ({ id: p.id, label: p.name }));
  }, [
    s.targetType,
    services,
    s.servers,
    s.sites,
    s.resources,
    s.backupPlans,
    s.alertEvents,
    s.deploymentRuns,
    s.projects,
  ]);

  const selectedStream = s.streams.find((st) => st.id === s.selectedStreamId) || null;
  const isSelectedSlsStream = Boolean(selectedStream?.sourceType === 'aliyun-sls');

  const loadData = usePersistFn(async () => {
    s.setError('');
    try {
      const [st, en, cr, rr, ss, stats, proj, app, srv, site, res, bk, al, dep] = await Promise.all(
        [
          apiRequest<LogStream[]>('GET:/logs/streams'),
          apiRequest('GET:/logs/entries'),
          apiRequest('GET:/logs/collection-runs'),
          apiRequest('GET:/logs/retention-runs'),
          apiRequest('GET:/logs/stream-sessions'),
          apiRequest('GET:/logs/stats'),
          apiRequest('GET:/projects'),
          apiRequest('GET:/applications'),
          apiRequest('GET:/servers'),
          apiRequest('GET:/sites'),
          apiRequest('GET:/resource-control/resources'),
          apiRequest('GET:/backups/plans'),
          apiRequest('GET:/monitoring/alert-events'),
          apiRequest('GET:/deployments/runs'),
        ],
      );
      s.setStreams(st as LogStream[]);
      s.setEntries(en as never[]);
      s.setCollectionRuns(cr as never[]);
      s.setRetentionRuns(rr as never[]);
      s.setStreamSessions(ss as never[]);
      s.setLogStats(stats as never);
      s.setProjects(proj as never[]);
      s.setApplications(app as never[]);
      s.setServers(srv as never[]);
      s.setSites(site as never[]);
      s.setResources(res as never[]);
      s.setBackupPlans(bk as never[]);
      s.setAlertEvents(al as never[]);
      s.setDeploymentRuns(dep as never[]);
      s.setSelectedStreamId((cur: string) => cur || (st as LogStream[])[0]?.id || '');
      s.setTargetId(
        (cur: string) =>
          cur || (app as { services?: { id: string }[] }[])?.[0]?.services?.[0]?.id || '',
      );
    } catch (err) {
      s.setError(err instanceof Error ? err.message : '加载日志中心数据失败');
    } finally {
      s.setLoading(false);
    }
  });

  useEffect(() => {
    loadData();
  }, [loadData]);

  const createStream = usePersistFn(async () => {
    if (s.targetType !== 'manual' && !s.targetId) {
      alert('请选择日志目标');
      return;
    }
    s.setSaving(true);
    s.setError('');
    try {
      const body: Record<string, unknown> = {
        name: s.streamName.trim() || `${formatTargetType(s.targetType as TargetType)}日志流`,
        sourceType: sourceTypeForTarget(
          s.targetType as TargetType,
          s.resources.find((r) => r.id === s.targetId) as ManagedResource | undefined,
        ),
      };
      const map: Record<string, string> = {
        service: 'applicationServiceId',
        server: 'serverId',
        site: 'siteId',
        resource: 'managedResourceId',
        backup: 'backupPlanId',
        deployment: 'deploymentRunId',
        alert: 'alertEventId',
      };
      const key = map[s.targetType];
      if (key && s.targetId) body[key] = s.targetId;
      if (s.targetType === 'manual' && s.targetId) body.projectId = s.targetId;
      if (s.sourceKey.trim()) body.sourceKey = s.sourceKey.trim();
      const stream = await apiRequest<LogStream>('POST:/logs/streams', body);
      s.setStreamName('');
      s.setSourceKey('');
      s.setSelectedStreamId(stream.id);
      await loadData();
    } catch (err) {
      s.setError(err instanceof Error ? err.message : '创建日志流失败');
    } finally {
      s.setSaving(false);
    }
  });

  const appendEntry = usePersistFn(async () => {
    if (!s.selectedStreamId) {
      alert('请选择日志流');
      return;
    }
    if (!s.entryMessage.trim()) {
      alert('请输入日志内容');
      return;
    }
    s.setAppending(true);
    s.setError('');
    try {
      await apiRequest(`POST:/logs/streams/${s.selectedStreamId}/entries`, {
        level: s.entryLevel,
        message: s.entryMessage,
        source: 'manual',
      });
      s.setEntryMessage('');
      await loadData();
    } catch (err) {
      s.setError(err instanceof Error ? err.message : '追加日志失败');
    } finally {
      s.setAppending(false);
    }
  });

  const collectSelectedStream = usePersistFn(async () => {
    if (!s.selectedStreamId) {
      alert('请选择日志流');
      return;
    }
    s.setCollecting(true);
    s.setError('');
    try {
      const body: Record<string, unknown> = {
        dryRun: isSelectedSlsStream ? !t.slsLiveCollect : true,
        queue: t.queueLogCollections,
        tail: 200,
      };
      if (isSelectedSlsStream)
        body.params = {
          query: t.slsQuery.trim() || '*',
          windowMinutes: t.slsWindowMinutes,
          limit: t.slsLimit,
          logstore: selectedStream?.sourceKey || undefined,
          confirmLiveRead: t.slsLiveCollect && t.slsConfirmLiveRead,
        };
      await apiRequest(`POST:/logs/streams/${s.selectedStreamId}/collect`, body);
      await loadData();
    } catch (err) {
      s.setError(err instanceof Error ? err.message : '生成采集计划失败');
    } finally {
      s.setCollecting(false);
    }
  });

  const cleanupSelectedRetention = usePersistFn(async (dryRun: boolean) => {
    if (!s.selectedStreamId) {
      alert('请选择日志流');
      return;
    }
    t.setCleaningRetention(dryRun ? 'dry-run' : 'live');
    s.setError('');
    try {
      await apiRequest(`POST:/logs/streams/${s.selectedStreamId}/retention/cleanup`, { dryRun });
      await loadData();
    } catch (err) {
      s.setError(err instanceof Error ? err.message : '日志保留清理失败');
    } finally {
      t.setCleaningRetention('');
    }
  });

  const tail = useLogsTail({ s, t, selectedStream, isSelectedSlsStream, loadData });
  const policies = useLogsPolicies({ s, t, selectedStream, loadData });

  return {
    s,
    t,
    services,
    targetOptions,
    selectedStream,
    isSelectedSlsStream,
    loadData,
    createStream,
    appendEntry,
    collectSelectedStream,
    cleanupSelectedRetention,
    ...tail,
    ...policies,
  };
}
