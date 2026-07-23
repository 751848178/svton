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
import { useLogsActions } from './use-logs-actions.hooks';
import { fetchEntries, fetchStats } from './entries-query';
import type { LogStream } from '../types-stream';

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
      const [st, cr, rr, ss, proj, app, srv, site, res, bk, al, dep] = await Promise.all([
        apiRequest<LogStream[]>('GET:/logs/streams'),
        apiRequest('GET:/logs/collection-runs'),
        apiRequest('GET:/logs/retention-runs'),
        apiRequest('GET:/logs/stream-sessions'),
        apiRequest('GET:/projects'),
        apiRequest('GET:/applications'),
        apiRequest('GET:/servers'),
        apiRequest('GET:/sites'),
        apiRequest('GET:/resource-control/resources'),
        apiRequest('GET:/backups/plans'),
        apiRequest('GET:/monitoring/alert-events'),
        apiRequest('GET:/deployments/runs'),
      ]);
      s.setStreams(st as LogStream[]);
      s.setCollectionRuns(cr as never[]);
      s.setRetentionRuns(rr as never[]);
      s.setStreamSessions(ss as never[]);
      s.setProjects(proj as never[]);
      s.setApplications(app as never[]);
      s.setServers(srv as never[]);
      s.setSites(site as never[]);
      s.setResources(res as never[]);
      s.setBackupPlans(bk as never[]);
      s.setAlertEvents(al as never[]);
      s.setDeploymentRuns(dep as never[]);
      // 先在本地解析出新的 streamId,再同步给 state ——
      // fetchEntries(s) 读的是稳定快照 s.selectedStreamId,setSelectedStreamId 的更新尚未反映进来,
      // 直接用 s 会导致首拉拿到空/旧 streamId(m3)。用解析后的本地值参与查询构造。
      const resolvedStreamId = s.selectedStreamId || (st as LogStream[])[0]?.id || '';
      s.setSelectedStreamId(resolvedStreamId);
      s.setTargetId(
        (cur: string) =>
          cur || (app as { services?: { id: string }[] }[])?.[0]?.services?.[0]?.id || '',
      );
      // 首次加载后按当前 explorer 过滤器(用本地解析的 streamId)拉取条目/统计。
      s.setEntries(await fetchEntries({ ...s, selectedStreamId: resolvedStreamId }));
      s.setLogStats(await fetchStats({ ...s, selectedStreamId: resolvedStreamId }));
    } catch (err) {
      s.setError(err instanceof Error ? err.message : '加载日志中心数据失败');
    } finally {
      s.setLoading(false);
    }
  });

  /** 按 explorer 过滤器（stream/level/query/timeRange）重新拉取条目与统计。 */
  const reloadExplorer = usePersistFn(async () => {
    s.setEntriesLoading(true);
    try {
      s.setEntries(await fetchEntries(s));
      s.setLogStats(await fetchStats(s));
    } catch (err) {
      s.setError(err instanceof Error ? err.message : '加载日志条目失败');
    } finally {
      s.setEntriesLoading(false);
    }
  });

  // 过滤器变化时防抖重新查询（search/level/timeRange/streamId）。
  useEffect(() => {
    if (s.loading) return;
    const handle = window.setTimeout(reloadExplorer, 350);
    return () => window.clearTimeout(handle);
    // 仅依赖过滤器，避免重复全量加载。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.selectedStreamId, s.activeLevel, s.activeQuery, s.timeRangeMinutes]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const actions = useLogsActions({ s, t, selectedStream, isSelectedSlsStream, loadData });
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
    reloadExplorer,
    ...actions,
    ...tail,
    ...policies,
  };
}
