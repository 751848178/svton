/**
 * 仪表盘数据 Hook
 *
 * 单一职责：聚合仪表盘五类数据源并派生统计量。
 *
 * 数据源与过滤参数（以 devpilot-api controller DTO 为准）：
 * - GET:/operation-approvals?status=pending —— 待我审批（ListOperationApprovalsQueryDto.status）
 * - GET:/projects —— 项目总数
 * - GET:/resource-requests —— 申请近况 + pending 计数（支持 ?status=，但近况需全量，客户端过滤）
 * - GET:/deployments/runs —— 最近部署 + 进行中/24h 失败计数（后端按 startedAt desc 限 30 条）
 * - GET:/monitoring/alert-events —— 活跃告警（ListAlertEventsQueryDto.status 支持 firing，
 *   这里取全量以复用 usePollingList 的 firing 驱动轮询语义）
 *
 * 轮询：运行中部署 / firing 告警经 usePollingList 数据驱动轮询，终态自动停止。
 */

import { useMemo } from 'react';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { useQueryLoose } from '@/hooks/api/use-api';
import { usePollingList } from '@/hooks/use-polling-list';
import type {
  DashboardAlertEvent,
  DashboardApproval,
  DashboardDeploymentRun,
  DashboardProject,
  DashboardResourceRequest,
} from '../types';

/** 进行中部署状态。 */
const ACTIVE_RUN_STATUSES = new Set(['queued', 'running']);

/** 24 小时毫秒数，用于失败部署时间窗。 */
const DAY_MS = 24 * 60 * 60 * 1000;

/** 最近部署时间线条数。 */
const RECENT_RUNS_LIMIT = 6;

/** 资源申请近况条数。 */
const RECENT_REQUESTS_LIMIT = 5;

export function useDashboard() {
  const approvalsSWR = useQueryLoose<DashboardApproval[]>('GET:/operation-approvals?status=pending');
  const projectsSWR = useQueryLoose<DashboardProject[]>('GET:/projects');
  const requestsSWR = useQueryLoose<DashboardResourceRequest[]>('GET:/resource-requests');

  // 存在 queued/running 运行时 5s 轮询，全部终态后自动停止。
  const runsSWR = usePollingList<DashboardDeploymentRun>(
    'GET:/deployments/runs',
    () => apiRequest<DashboardDeploymentRun[]>('GET:/deployments/runs'),
    { isActive: (run) => ACTIVE_RUN_STATUSES.has(run.status), interval: 5000 },
  );

  // 存在 firing 告警时 15s 轮询（对齐 monitoring 页语义），无活跃告警自动停止。
  const alertsSWR = usePollingList<DashboardAlertEvent>(
    'GET:/monitoring/alert-events',
    () => apiRequest<DashboardAlertEvent[]>('GET:/monitoring/alert-events'),
    { isActive: (event) => event.status === 'firing', interval: 15000 },
  );

  const sources = [approvalsSWR, projectsSWR, requestsSWR, runsSWR, alertsSWR];

  const approvals = useMemo(() => approvalsSWR.data ?? [], [approvalsSWR.data]);
  const projects = useMemo(() => projectsSWR.data ?? [], [projectsSWR.data]);
  const requests = useMemo(() => requestsSWR.data ?? [], [requestsSWR.data]);
  const runs = useMemo(() => runsSWR.data ?? [], [runsSWR.data]);
  const alerts = useMemo(() => alertsSWR.data ?? [], [alertsSWR.data]);

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      pendingApprovals: approvals.length,
      failedDeployments24h: runs.filter(
        (run) => run.status === 'failed' && now - new Date(run.startedAt).getTime() < DAY_MS,
      ).length,
      firingAlerts: alerts.filter((event) => event.status === 'firing').length,
      projectCount: projects.length,
      runningDeployments: runs.filter((run) => ACTIVE_RUN_STATUSES.has(run.status)).length,
      pendingRequests: requests.filter((request) => request.status === 'pending').length,
    };
  }, [alerts, approvals, projects, requests, runs]);

  const recentRuns = useMemo(() => runs.slice(0, RECENT_RUNS_LIMIT), [runs]);

  const recentRequests = useMemo(
    () =>
      [...requests]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, RECENT_REQUESTS_LIMIT),
    [requests],
  );

  // 首屏加载：任一源处于首次加载即视为加载中；部分失败时保留已成功分区渲染。
  const loading = sources.some((source) => source.isLoading);
  const hasAnyData = sources.some((source) => source.data !== undefined);
  const error = sources.find((source) => source.error)?.error ?? null;

  const retry = usePersistFn(() => {
    for (const source of sources) {
      void source.mutate();
    }
  });

  return {
    stats,
    recentRuns,
    recentRequests,
    loading,
    hasAnyData,
    error,
    retry,
  };
}
