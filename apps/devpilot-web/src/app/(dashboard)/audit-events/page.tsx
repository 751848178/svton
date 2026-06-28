'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

interface AuditEvent {
  id: string;
  category: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  risk: 'low' | 'medium' | 'high' | string;
  status: 'running' | 'completed' | 'failed' | 'blocked' | string;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
  occurredAt: string;
  actor?: { id: string; name?: string | null; email: string } | null;
  project?: { id: string; name: string } | null;
  environment?: { id: string; key: string; name: string; status: string } | null;
  application?: { id: string; name: string; status: string } | null;
  applicationService?: { id: string; name: string; kind: string; runtime?: string | null } | null;
  server?: { id: string; name: string; host: string } | null;
  site?: { id: string; name: string; primaryDomain: string } | null;
  managedResource?: {
    id: string;
    name: string;
    sourceType: string;
    provider: string;
    kind: string;
    endpoint?: string | null;
  } | null;
  deploymentRun?: { id: string; source: string; trigger: string; status: string } | null;
  resourceActionRun?: { id: string; action: string; status: string; dryRun: boolean } | null;
  applicationServiceOperationRun?: { id: string; action: string; status: string; dryRun: boolean } | null;
  backupRun?: { id: string; backupType: string; status: string; dryRun: boolean } | null;
  alertEvent?: { id: string; metric: string; severity: string; status: string } | null;
  logStream?: { id: string; name: string; sourceType: string; status: string } | null;
  logEntry?: { id: string; level: string; message: string; timestamp: string } | null;
}

const categoryLabels: Record<string, string> = {
  deployment: '部署',
  resource_action: '资源动作',
  service_operation: '服务操作',
  backup: '备份',
  alert: '告警',
  log: '日志',
};

const statusLabels: Record<string, string> = {
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  blocked: '已阻塞',
};

const riskLabels: Record<string, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
};

const statusClasses: Record<string, string> = {
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  blocked: 'bg-yellow-100 text-yellow-700',
};

const riskClasses: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
};

export default function AuditEventsPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [risk, setRisk] = useState('all');

  const loadData = async () => {
    setError('');
    try {
      const params: Record<string, string> = {};
      if (category !== 'all') params.category = category;
      if (status !== 'all') params.status = status;
      if (risk !== 'all') params.risk = risk;

      const data = await api.get<AuditEvent[]>('/audit-events', { params });
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载审计事件失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, status, risk]);

  const stats = useMemo(() => {
    return {
      total: events.length,
      deployments: events.filter((event) => event.category === 'deployment').length,
      resourceActions: events.filter((event) => event.category === 'resource_action').length,
      serviceOperations: events.filter((event) => event.category === 'service_operation').length,
      backups: events.filter((event) => event.category === 'backup').length,
      alerts: events.filter((event) => event.category === 'alert').length,
      logs: events.filter((event) => event.category === 'log').length,
      highRisk: events.filter((event) => event.risk === 'high').length,
      failed: events.filter((event) => ['failed', 'blocked'].includes(event.status)).length,
    };
  }, [events]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">审计事件</h1>
          <p className="mt-1 text-muted-foreground">
            查看部署、资源动作和服务运行态操作的统一控制面记录
          </p>
        </div>
        <button
          onClick={loadData}
          className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
        >
          刷新
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-9">
        <Metric label="事件总数" value={stats.total} />
        <Metric label="部署" value={stats.deployments} />
        <Metric label="资源动作" value={stats.resourceActions} />
        <Metric label="服务操作" value={stats.serviceOperations} />
        <Metric label="备份" value={stats.backups} />
        <Metric label="告警" value={stats.alerts} />
        <Metric label="日志" value={stats.logs} />
        <Metric label="高风险" value={stats.highRisk} />
        <Metric label="异常/阻塞" value={stats.failed} />
      </div>

      <div className="flex flex-wrap gap-3 rounded-lg border p-4">
        <FilterSelect
          label="分类"
          value={category}
          onChange={setCategory}
          options={[
            { value: 'all', label: '全部分类' },
            { value: 'deployment', label: '部署' },
            { value: 'resource_action', label: '资源动作' },
            { value: 'service_operation', label: '服务操作' },
            { value: 'backup', label: '备份' },
            { value: 'alert', label: '告警' },
            { value: 'log', label: '日志' },
          ]}
        />
        <FilterSelect
          label="状态"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: '全部状态' },
            { value: 'completed', label: '已完成' },
            { value: 'failed', label: '失败' },
            { value: 'blocked', label: '已阻塞' },
            { value: 'running', label: '运行中' },
          ]}
        />
        <FilterSelect
          label="风险"
          value={risk}
          onChange={setRisk}
          options={[
            { value: 'all', label: '全部风险' },
            { value: 'low', label: '低风险' },
            { value: 'medium', label: '中风险' },
            { value: 'high', label: '高风险' },
          ]}
        />
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">加载中...</div>
      ) : events.length === 0 ? (
        <div className="rounded-lg border py-12 text-center">
          <h3 className="text-lg font-medium">暂无审计事件</h3>
          <p className="mt-2 text-muted-foreground">
            触发部署、资源动作或服务操作后会在这里出现
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">时间</th>
                <th className="px-4 py-3 font-medium">动作</th>
                <th className="px-4 py-3 font-medium">目标</th>
                <th className="px-4 py-3 font-medium">范围</th>
                <th className="px-4 py-3 font-medium">执行人</th>
                <th className="px-4 py-3 font-medium">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {events.map((event) => (
                <tr key={event.id} className="align-top hover:bg-muted/30">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatDate(event.occurredAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{categoryLabels[event.category] || event.category}</span>
                      <Badge className={riskClasses[event.risk] || 'bg-gray-100 text-gray-700'}>
                        {riskLabels[event.risk] || event.risk}
                      </Badge>
                    </div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">{event.action}</div>
                    {event.summary && (
                      <div className="mt-1 text-xs text-muted-foreground">{event.summary}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{formatTarget(event)}</div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">
                      {event.targetType}{event.targetId ? ` · ${event.targetId}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div>{event.project?.name || '未关联项目'}</div>
                    <div className="mt-1 text-xs">
                      {event.environment?.name || event.environment?.key || '未关联环境'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {event.actor?.name || event.actor?.email || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={statusClasses[event.status] || 'bg-gray-100 text-gray-700'}>
                      {statusLabels[event.status] || event.status}
                    </Badge>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {formatRunRef(event)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block min-w-44 text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border px-3 py-2"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Badge({ className, children }: { className: string; children: string | number }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${className}`}>
      {children}
    </span>
  );
}

function formatTarget(event: AuditEvent) {
  return (
    event.applicationService?.name ||
    event.managedResource?.name ||
    event.site?.name ||
    event.server?.name ||
    event.application?.name ||
    event.project?.name ||
    event.targetId ||
    '-'
  );
}

function formatRunRef(event: AuditEvent) {
  if (event.deploymentRun) {
    return `${event.deploymentRun.trigger} · ${event.deploymentRun.status}`;
  }
  if (event.resourceActionRun) {
    return `${event.resourceActionRun.action} · ${event.resourceActionRun.dryRun ? 'dry-run' : 'live'}`;
  }
  if (event.applicationServiceOperationRun) {
    return `${event.applicationServiceOperationRun.action} · ${event.applicationServiceOperationRun.dryRun ? 'dry-run' : 'live'}`;
  }
  if (event.backupRun) {
    return `${event.backupRun.backupType} · ${event.backupRun.dryRun ? 'dry-run' : 'live'}`;
  }
  if (event.alertEvent) {
    return `${event.alertEvent.metric} · ${event.alertEvent.status}`;
  }
  if (event.logStream) {
    return `${event.logStream.name} · ${event.logStream.sourceType}`;
  }
  if (event.logEntry) {
    return `${event.logEntry.level} · ${event.logEntry.message.slice(0, 24)}`;
  }
  return '-';
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
