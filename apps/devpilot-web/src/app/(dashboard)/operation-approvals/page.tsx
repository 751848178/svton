'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

interface OperationApproval {
  id: string;
  requesterId?: string | null;
  reviewerId?: string | null;
  projectId?: string | null;
  environmentId?: string | null;
  applicationId?: string | null;
  applicationServiceId?: string | null;
  serverId?: string | null;
  siteId?: string | null;
  managedResourceId?: string | null;
  category: 'resource_action' | 'service_operation' | 'deployment' | string;
  action: string;
  targetType: string;
  targetId?: string | null;
  risk: 'low' | 'medium' | 'high' | string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | string;
  summary?: string | null;
  reason?: string | null;
  reviewComment?: string | null;
  metadata?: Record<string, unknown> | null;
  requestedAt: string;
  reviewedAt?: string | null;
  consumedAt?: string | null;
  requester?: { id: string; name?: string | null; email: string } | null;
  reviewer?: { id: string; name?: string | null; email: string } | null;
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
}

const categoryLabels: Record<string, string> = {
  resource_action: '资源动作',
  service_operation: '服务操作',
  deployment: '部署',
  site_sync: '站点同步',
};

const statusLabels: Record<string, string> = {
  pending: '待审批',
  approved: '已批准',
  rejected: '已拒绝',
  cancelled: '已取消',
};

const riskLabels: Record<string, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
};

const statusClasses: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-700',
};

const riskClasses: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
};

export default function OperationApprovalsPage() {
  const [approvals, setApprovals] = useState<OperationApproval[]>([]);
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    setError('');
    try {
      const params = status === 'all' ? undefined : { status };
      const data = await api.get<OperationApproval[]>('/operation-approvals', params ? { params } : undefined);
      setApprovals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载操作审批失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const stats = useMemo(() => ({
    total: approvals.length,
    pending: approvals.filter((approval) => approval.status === 'pending').length,
    approved: approvals.filter((approval) => approval.status === 'approved').length,
    rejected: approvals.filter((approval) => approval.status === 'rejected').length,
    highRisk: approvals.filter((approval) => approval.risk === 'high').length,
  }), [approvals]);

  const reviewApproval = async (approval: OperationApproval, decision: 'approved' | 'rejected') => {
    setActingId(`${approval.id}:${decision}`);
    setError('');
    try {
      await api.post(`/operation-approvals/${approval.id}/review`, {
        decision,
        reviewComment: decision === 'approved' ? '同意执行' : '拒绝执行',
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '审批操作失败');
    } finally {
      setActingId('');
    }
  };

  const executeApproved = async (approval: OperationApproval) => {
    setActingId(`${approval.id}:execute`);
    setError('');
    try {
      if (approval.category === 'resource_action') {
        if (!approval.managedResourceId || !approval.managedResource?.name) {
          throw new Error('审批单缺少资源目标');
        }
        await api.post(`/resource-control/resources/${approval.managedResourceId}/actions`, {
          action: stripPrefix(approval.action, 'resource.'),
          dryRun: false,
          queue: readMetadataBoolean(approval.metadata, 'queue'),
          maxAttempts: readMetadataNumber(approval.metadata, 'maxAttempts'),
          approvalId: approval.id,
          confirmationText: approval.managedResource.name,
        });
      } else if (approval.category === 'service_operation') {
        if (!approval.applicationId || !approval.applicationServiceId || !approval.applicationService?.name) {
          throw new Error('审批单缺少服务目标');
        }
        await api.post(`/applications/${approval.applicationId}/services/${approval.applicationServiceId}/operations`, {
          action: stripPrefix(approval.action, 'application-service.'),
          dryRun: false,
          queue: readMetadataBoolean(approval.metadata, 'queue'),
          maxAttempts: readMetadataNumber(approval.metadata, 'maxAttempts'),
          approvalId: approval.id,
          confirmationText: approval.applicationService.name,
        });
      } else if (approval.category === 'site_sync') {
        const siteId = approval.siteId || approval.site?.id || approval.targetId;
        if (!siteId || !approval.site?.name) {
          throw new Error('审批单缺少站点目标');
        }

        if (approval.action === 'site.rollback') {
          const sourceRunId = readMetadataString(approval.metadata, 'sourceRunId');
          if (!sourceRunId) {
            throw new Error('审批单缺少回滚源运行记录');
          }

          await api.post(`/sites/${siteId}/sync-runs/${sourceRunId}/rollback`, {
            dryRun: false,
            queue: readMetadataBoolean(approval.metadata, 'queue'),
            approvalId: approval.id,
            confirmationText: approval.site.name,
          });
        } else {
          await api.post(`/sites/${siteId}/sync-plan`, {
            dryRun: false,
            queue: readMetadataBoolean(approval.metadata, 'queue'),
            approvalId: approval.id,
            confirmationText: approval.site.name,
          });
        }
      } else if (approval.category === 'deployment') {
        if (!approval.projectId || !approval.project?.name) {
          throw new Error('审批单缺少项目目标');
        }

        if (approval.action === 'deployment.rollback') {
          const sourceRunId = readMetadataString(approval.metadata, 'sourceRunId');
          if (!sourceRunId) {
            throw new Error('审批单缺少回滚源运行记录');
          }

          await api.post(`/deployments/runs/${sourceRunId}/rollback`, {
            dryRun: false,
            queue: readMetadataBoolean(approval.metadata, 'queue'),
            maxAttempts: readMetadataNumber(approval.metadata, 'maxAttempts'),
            approvalId: approval.id,
            confirmationText: approval.project.name,
          });
        } else {
          await api.post(`/deployments/projects/${approval.projectId}/runs`, {
            dryRun: false,
            queue: readMetadataBoolean(approval.metadata, 'queue'),
            maxAttempts: readMetadataNumber(approval.metadata, 'maxAttempts'),
            approvalId: approval.id,
            confirmationText: approval.project.name,
            environmentId: approval.environmentId || readMetadataString(approval.metadata, 'environmentId'),
            applicationId: approval.applicationId || readMetadataString(approval.metadata, 'applicationId'),
            applicationServiceId: approval.applicationServiceId || readMetadataString(approval.metadata, 'applicationServiceId'),
            serverId: approval.serverId || readMetadataString(approval.metadata, 'serverId'),
            branch: readMetadataString(approval.metadata, 'branch'),
            commitSha: readMetadataString(approval.metadata, 'commitSha'),
          });
        }
      } else {
        throw new Error('当前审批类型暂不支持页面执行');
      }

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '执行已批准操作失败');
    } finally {
      setActingId('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">操作审批</h1>
          <p className="mt-1 text-muted-foreground">
            审批资源动作、服务操作、部署和站点同步/回滚的 live 执行申请
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

      <div className="grid gap-4 md:grid-cols-5">
        <Metric label="当前列表" value={stats.total} />
        <Metric label="待审批" value={stats.pending} />
        <Metric label="已批准" value={stats.approved} />
        <Metric label="已拒绝" value={stats.rejected} />
        <Metric label="高风险" value={stats.highRisk} />
      </div>

      <div className="rounded-lg border p-4">
        <label className="block max-w-xs text-sm">
          <span className="mb-1 block font-medium">状态</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="pending">待审批</option>
            <option value="approved">已批准</option>
            <option value="rejected">已拒绝</option>
            <option value="all">全部</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">加载中...</div>
      ) : approvals.length === 0 ? (
        <div className="rounded-lg border py-12 text-center">
          <h3 className="text-lg font-medium">暂无操作审批</h3>
          <p className="mt-2 text-muted-foreground">
            申请 live 执行资源动作、服务操作、部署或站点操作后会在这里出现
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {approvals.map((approval) => (
            <div key={approval.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{approval.summary || approval.action}</h3>
                    <Badge className={statusClasses[approval.status] || 'bg-gray-100 text-gray-700'}>
                      {statusLabels[approval.status] || approval.status}
                    </Badge>
                    <Badge className={riskClasses[approval.risk] || 'bg-gray-100 text-gray-700'}>
                      {riskLabels[approval.risk] || approval.risk}
                    </Badge>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {categoryLabels[approval.category] || approval.category} · {approval.action}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    目标：{formatTarget(approval)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    项目：{approval.project?.name || '未关联'} · 环境：{approval.environment?.name || approval.environment?.key || '未关联'}
                  </div>
                  {approval.reason && (
                    <div className="mt-2 rounded-md bg-muted/50 p-2 text-sm">
                      {approval.reason}
                    </div>
                  )}
                  {readMetadataString(approval.metadata, 'diffSummary') && (
                    <div className="mt-2 rounded-md bg-muted/50 p-2 font-mono text-xs">
                      {readMetadataString(approval.metadata, 'diffSummary')}
                    </div>
                  )}
                  <div className="mt-2 text-xs text-muted-foreground">
                    申请人：{approval.requester?.name || approval.requester?.email || '-'} ·
                    申请时间：{formatDate(approval.requestedAt)}
                    {approval.reviewer && ` · 审批人：${approval.reviewer.name || approval.reviewer.email}`}
                    {approval.consumedAt && ` · 已消费：${formatDate(approval.consumedAt)}`}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {approval.status === 'pending' && (
                    <>
                      <button
                        onClick={() => reviewApproval(approval, 'approved')}
                        disabled={Boolean(actingId)}
                        className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
                      >
                        {actingId === `${approval.id}:approved` ? '处理中...' : '批准'}
                      </button>
                      <button
                        onClick={() => reviewApproval(approval, 'rejected')}
                        disabled={Boolean(actingId)}
                        className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
                      >
                        {actingId === `${approval.id}:rejected` ? '处理中...' : '拒绝'}
                      </button>
                    </>
                  )}
                  {approval.status === 'approved' && !approval.consumedAt && (
                    <button
                      onClick={() => executeApproved(approval)}
                      disabled={Boolean(actingId)}
                      className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
                    >
                      {actingId === `${approval.id}:execute` ? '执行中...' : '执行已批准'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
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

function Badge({ className, children }: { className: string; children: string | number }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${className}`}>
      {children}
    </span>
  );
}

function formatTarget(approval: OperationApproval) {
  return (
    approval.applicationService?.name ||
    approval.managedResource?.name ||
    approval.site?.name ||
    approval.server?.name ||
    approval.application?.name ||
    approval.project?.name ||
    approval.targetId ||
    '-'
  );
}

function stripPrefix(value: string, prefix: string) {
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

function readMetadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readMetadataBoolean(metadata: Record<string, unknown> | null | undefined, key: string) {
  return metadata?.[key] === true;
}

function readMetadataNumber(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
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
