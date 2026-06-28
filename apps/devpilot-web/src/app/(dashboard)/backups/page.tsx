'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface ManagedResource {
  id: string;
  sourceType: 'server' | 'cloud' | 'manual';
  provider: string;
  kind: string;
  name: string;
  endpoint?: string | null;
  status: string;
  project?: { id: string; name: string } | null;
  environment?: { id: string; key: string; name: string; status: string } | null;
  server?: { id: string; name: string; host: string; status?: string } | null;
}

interface BackupPlan {
  id: string;
  name: string;
  backupType: string;
  schedule?: string | null;
  retentionDays: number;
  destinationType: string;
  status: 'active' | 'paused' | 'archived' | string;
  lastRunAt?: string | null;
  lastStatus?: string | null;
  createdAt: string;
  updatedAt: string;
  resource?: ManagedResource | null;
  project?: { id: string; name: string } | null;
  environment?: { id: string; key: string; name: string; status: string } | null;
  server?: { id: string; name: string; host: string; status?: string } | null;
  runs?: Array<{
    id: string;
    status: string;
    dryRun: boolean;
    trigger: string;
    startedAt: string;
    finishedAt?: string | null;
    error?: string | null;
    serverExecutionJob?: ServerExecutionJobRef | null;
  }>;
}

interface ServerExecutionJobRef {
  id: string;
  status: string;
  queueMode: string;
  attempt: number;
  maxAttempts: number;
  queuedAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
}

interface BackupRun {
  id: string;
  trigger: string;
  backupType: string;
  executorKey: string;
  adapterKey: string;
  dryRun: boolean;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'blocked' | string;
  serverExecutionJobId?: string | null;
  serverExecutionJob?: ServerExecutionJobRef | null;
  destinationType: string;
  startedAt: string;
  finishedAt?: string | null;
  error?: string | null;
  plan?: { id: string; name: string; status: string; schedule?: string | null } | null;
  resource?: ManagedResource | null;
  server?: { id: string; name: string; host: string } | null;
}

const providerLabels: Record<string, string> = {
  docker: 'Docker',
  'aliyun-rds': '阿里云 RDS',
};

const kindLabels: Record<string, string> = {
  mysql: 'MySQL',
  redis: 'Redis',
  database: '数据库',
};

const backupTypeLabels: Record<string, string> = {
  logical: '逻辑备份',
  snapshot: '快照',
  file: '文件备份',
};

const statusLabels: Record<string, string> = {
  active: '启用',
  paused: '暂停',
  archived: '归档',
  queued: '已入队',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  blocked: '已阻塞',
};

const statusClasses: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  archived: 'bg-gray-100 text-gray-700',
  queued: 'bg-blue-100 text-blue-700',
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  blocked: 'bg-yellow-100 text-yellow-700',
};

export default function BackupsPage() {
  const [plans, setPlans] = useState<BackupPlan[]>([]);
  const [runs, setRuns] = useState<BackupRun[]>([]);
  const [resources, setResources] = useState<ManagedResource[]>([]);
  const [resourceId, setResourceId] = useState('');
  const [name, setName] = useState('');
  const [backupType, setBackupType] = useState('auto');
  const [destinationType, setDestinationType] = useState('local');
  const [retentionDays, setRetentionDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [queueBackupRuns, setQueueBackupRuns] = useState(false);
  const [runningPlanId, setRunningPlanId] = useState('');
  const [updatingPlanId, setUpdatingPlanId] = useState('');
  const [error, setError] = useState('');

  const backupableResources = useMemo(() => {
    return resources.filter((resource) => {
      if (resource.sourceType === 'server' && resource.provider === 'docker') {
        return ['mysql', 'redis', 'database'].includes(resource.kind);
      }
      return resource.sourceType === 'cloud'
        && resource.provider === 'aliyun-rds'
        && resource.kind === 'database';
    });
  }, [resources]);

  const selectedResource = backupableResources.find((resource) => resource.id === resourceId);

  const stats = useMemo(() => ({
    total: plans.length,
    active: plans.filter((plan) => plan.status === 'active').length,
    blockedRuns: runs.filter((run) => run.status === 'blocked').length,
    failedRuns: runs.filter((run) => run.status === 'failed').length,
  }), [plans, runs]);

  const loadData = async () => {
    setError('');
    try {
      const [planData, runData, resourceData] = await Promise.all([
        api.get<BackupPlan[]>('/backups/plans'),
        api.get<BackupRun[]>('/backups/runs'),
        api.get<ManagedResource[]>('/resource-control/resources'),
      ]);
      setPlans(planData);
      setRuns(runData);
      setResources(resourceData);
      const firstBackupable = resourceData.find((resource) => (
        (resource.sourceType === 'server' && resource.provider === 'docker' && ['mysql', 'redis', 'database'].includes(resource.kind))
        || (resource.sourceType === 'cloud' && resource.provider === 'aliyun-rds' && resource.kind === 'database')
      ));
      if (!resourceId && firstBackupable) {
        setResourceId(firstBackupable.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载备份数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createPlan = async () => {
    if (!resourceId || !selectedResource) {
      alert('请选择可备份资源');
      return;
    }

    setCreating(true);
    setError('');
    try {
      await api.post('/backups/plans', {
        resourceId,
        name: name.trim() || `${selectedResource.name} 备份计划`,
        backupType: backupType === 'auto' ? undefined : backupType,
        retentionDays,
        destinationType,
      });
      setName('');
      setBackupType('auto');
      setDestinationType('local');
      setRetentionDays(7);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建备份计划失败');
    } finally {
      setCreating(false);
    }
  };

  const runPlan = async (plan: BackupPlan) => {
    setRunningPlanId(plan.id);
    setError('');
    try {
      await api.post(`/backups/plans/${plan.id}/runs`, {
        dryRun: true,
        queue: queueBackupRuns && canQueueBackupRun(plan),
        trigger: 'manual',
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成备份计划失败');
    } finally {
      setRunningPlanId('');
    }
  };

  const togglePlanStatus = async (plan: BackupPlan) => {
    const nextStatus = plan.status === 'active' ? 'paused' : 'active';
    setUpdatingPlanId(plan.id);
    setError('');
    try {
      await api.put(`/backups/plans/${plan.id}`, { status: nextStatus });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新备份计划失败');
    } finally {
      setUpdatingPlanId('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">备份计划</h1>
          <p className="mt-1 text-muted-foreground">
            管理数据库和中间件资源的备份计划、dry-run 执行计划和运行记录
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={queueBackupRuns}
              onChange={(event) => setQueueBackupRuns(event.target.checked)}
            />
            服务器备份加入队列
          </label>
          <button
            onClick={loadData}
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
          >
            刷新
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="计划总数" value={stats.total} />
        <Metric label="启用中" value={stats.active} />
        <Metric label="已阻塞" value={stats.blockedRuns} />
        <Metric label="失败运行" value={stats.failedRuns} />
      </div>

      <div className="rounded-lg border p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(180px,0.6fr)_minmax(160px,0.5fr)_minmax(140px,0.4fr)_auto]">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">资源</span>
            <select
              value={resourceId}
              onChange={(event) => setResourceId(event.target.value)}
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="">请选择资源</option>
              {backupableResources.map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.name} · {providerLabels[resource.provider] || resource.provider} · {kindLabels[resource.kind] || resource.kind}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">名称</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={selectedResource ? `${selectedResource.name} 备份计划` : '备份计划名称'}
              className="w-full rounded-md border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">类型</span>
            <select
              value={backupType}
              onChange={(event) => setBackupType(event.target.value)}
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="auto">自动</option>
              <option value="logical">逻辑备份</option>
              <option value="snapshot">快照</option>
              <option value="file">文件备份</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">保留天数</span>
            <input
              type="number"
              min={1}
              value={retentionDays}
              onChange={(event) => setRetentionDays(Number(event.target.value))}
              className="w-full rounded-md border px-3 py-2"
            />
          </label>
          <div className="flex items-end">
            <button
              onClick={createPlan}
              disabled={creating || !resourceId}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              {creating ? '创建中...' : '创建计划'}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">加载中...</div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-4">
            {plans.length === 0 ? (
              <div className="rounded-lg border py-12 text-center">
                <h3 className="text-lg font-medium">暂无备份计划</h3>
                <p className="mt-2 text-muted-foreground">
                  同步 Docker 或 RDS 资源后可以在这里创建备份计划
                </p>
              </div>
            ) : plans.map((plan) => (
              <div key={plan.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{plan.name}</h3>
                      <Badge className={statusClasses[plan.status] || 'bg-gray-100 text-gray-700'}>
                        {statusLabels[plan.status] || plan.status}
                      </Badge>
                      {plan.lastStatus && (
                        <Badge className={statusClasses[plan.lastStatus] || 'bg-gray-100 text-gray-700'}>
                          {`最近：${statusLabels[plan.lastStatus] || plan.lastStatus}`}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {backupTypeLabels[plan.backupType] || plan.backupType} · 保留 {plan.retentionDays} 天 · {plan.destinationType}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      资源：{formatResource(plan.resource)} · 服务器：{plan.server?.name || '未绑定'}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      项目：{plan.project?.name || '未关联'} · 环境：{plan.environment?.name || plan.environment?.key || '未关联'} · 最近运行：{plan.lastRunAt ? formatDate(plan.lastRunAt) : '-'}
                    </div>
                    {plan.runs && plan.runs.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {plan.runs.map((run) => (
                          <span key={run.id} className="rounded-md bg-muted px-2 py-1">
                            {statusLabels[run.status] || run.status} · {formatDate(run.startedAt)}
                            {run.serverExecutionJob ? ` · Job ${run.serverExecutionJob.id.slice(0, 8)}` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <RunBackupButton
                      plan={plan}
                      runningPlanId={runningPlanId}
                      queueBackupRuns={queueBackupRuns}
                      onRun={runPlan}
                    />
                    <button
                      onClick={() => togglePlanStatus(plan)}
                      disabled={Boolean(updatingPlanId) || plan.status === 'archived'}
                      className="rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
                    >
                      {updatingPlanId === plan.id ? '更新中...' : plan.status === 'active' ? '暂停' : '启用'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border">
            <div className="border-b px-4 py-3">
              <h2 className="font-medium">最近运行</h2>
            </div>
            <div className="divide-y">
              {runs.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  暂无备份运行
                </div>
              ) : runs.slice(0, 12).map((run) => (
                <div key={run.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {run.plan?.name || run.resource?.name || run.id}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {run.executorKey} · {run.adapterKey} · {run.dryRun ? 'dry-run' : 'live'}
                      </div>
                    </div>
                    <Badge className={statusClasses[run.status] || 'bg-gray-100 text-gray-700'}>
                      {statusLabels[run.status] || run.status}
                    </Badge>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {formatResource(run.resource)} · {formatDate(run.startedAt)}
                  </div>
                  {run.serverExecutionJob && (
                    <div className="mt-1 text-xs">
                      <Link href="/execution-governance" className="text-primary hover:underline">
                        Job {run.serverExecutionJob.id.slice(0, 8)} · {statusLabels[run.serverExecutionJob.status] || run.serverExecutionJob.status}
                      </Link>
                    </div>
                  )}
                  {run.error && (
                    <div className="mt-2 rounded-md bg-yellow-50 px-2 py-1 text-xs text-yellow-800">
                      {run.error}
                    </div>
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

function Badge({ children, className }: { children: string | number; className: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

function RunBackupButton({
  plan,
  runningPlanId,
  queueBackupRuns,
  onRun,
}: {
  plan: BackupPlan;
  runningPlanId: string;
  queueBackupRuns: boolean;
  onRun: (plan: BackupPlan) => void;
}) {
  const queueThisRun = queueBackupRuns && canQueueBackupRun(plan);
  return (
    <button
      onClick={() => onRun(plan)}
      disabled={Boolean(runningPlanId) || plan.status !== 'active'}
      className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
    >
      {runningPlanId === plan.id
        ? (queueThisRun ? '入队中...' : '生成中...')
        : (queueThisRun ? '加入队列' : '生成计划')}
    </button>
  );
}

function formatResource(resource?: ManagedResource | null) {
  if (!resource) return '未知资源';
  const provider = providerLabels[resource.provider] || resource.provider;
  const kind = kindLabels[resource.kind] || resource.kind;
  return `${resource.name} · ${provider}/${kind}`;
}

function canQueueBackupRun(plan: BackupPlan) {
  return plan.resource?.sourceType === 'server';
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
