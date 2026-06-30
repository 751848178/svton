/**
 * 资源申请列表表格
 *
 * 单一职责：渲染申请列表 + 状态徽章 + 审批/取消/重试/交付/运行记录操作。
 */

import { usePersistFn } from '@svton/hooks';
import { Tag } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import type { ResourceRequest } from '../types';
import {
  getStatusBadge,
  getProvisioningBadge,
  canViewProvisioningRuns,
  canRetryProvisioning,
} from '../badges';

interface RequestTableProps {
  requests: ResourceRequest[];
  retryingId: string | null;
  onReview: (id: string, status: 'approved' | 'rejected') => void;
  onCancel: (id: string) => void;
  onRetryProvisioning: (request: ResourceRequest) => void;
  onComplete: (request: ResourceRequest) => void;
  onViewRuns: (request: ResourceRequest) => void;
}

export function RequestTable(props: RequestTableProps) {
  const { requests } = props;
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium">申请</th>
            <th className="px-4 py-3 text-left text-sm font-medium">资源类型</th>
            <th className="px-4 py-3 text-left text-sm font-medium">项目/环境</th>
            <th className="px-4 py-3 text-left text-sm font-medium">状态</th>
            <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {requests.map((request) => (
            <RequestRow
              key={request.id}
              request={request}
              {...props}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RequestRow({
  request,
  retryingId,
  onReview,
  onCancel,
  onRetryProvisioning,
  onComplete,
  onViewRuns,
}: {
  request: ResourceRequest;
  retryingId: string | null;
  onReview: (id: string, status: 'approved' | 'rejected') => void;
  onCancel: (id: string) => void;
  onRetryProvisioning: (request: ResourceRequest) => void;
  onComplete: (request: ResourceRequest) => void;
  onViewRuns: (request: ResourceRequest) => void;
}) {
  const handleApprove = usePersistFn(() => onReview(request.id, 'approved'));
  const handleReject = usePersistFn(() => onReview(request.id, 'rejected'));
  const handleCancel = usePersistFn(() => onCancel(request.id));
  const handleRetry = usePersistFn(() => onRetryProvisioning(request));
  const handleComplete = usePersistFn(() => onComplete(request));
  const handleViewRuns = usePersistFn(() => onViewRuns(request));

  return (
    <tr className="hover:bg-muted/30">
      <td className="px-4 py-3">
        <div className="font-medium">{request.title}</div>
        <div className="text-xs text-muted-foreground">
          {request.requester?.name || request.requester?.email || '-'} ·{' '}
          {new Date(request.createdAt).toLocaleString()}
        </div>
      </td>
      <td className="px-4 py-3 text-sm">
        <div>{request.resourceType?.name || '-'}</div>
        <code className="text-xs text-muted-foreground">{request.resourceType?.key}</code>
        {request.resourceType?.provisioningMode ? (
          <div className="mt-1 text-xs text-muted-foreground">
            交付：{request.resourceType.provisioningMode}
          </div>
        ) : null}
      </td>
      <td className="px-4 py-3 text-sm">
        <div>{request.project?.name || '未关联项目'}</div>
        <div className="text-xs text-muted-foreground">{request.environment || '未指定环境'}</div>
      </td>
      <td className="px-4 py-3">
        <div className="space-y-1">
          {getStatusBadge(request.status)}
          {getProvisioningBadge(request.result?.provisioning)}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          {canViewProvisioningRuns(request) ? (
            <button
              onClick={handleViewRuns}
              className="rounded border px-2 py-1 text-xs hover:bg-accent"
            >
              运行记录
            </button>
          ) : null}
          {request.status === 'pending' ? (
            <>
              <button
                onClick={handleApprove}
                className="rounded border px-2 py-1 text-xs hover:bg-accent"
              >
                通过
              </button>
              <button
                onClick={handleReject}
                className="rounded border px-2 py-1 text-xs hover:bg-accent"
              >
                驳回
              </button>
              <button
                onClick={handleCancel}
                className="rounded px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
              >
                取消
              </button>
            </>
          ) : null}
          {request.status === 'approved' ? (
            <>
              {canRetryProvisioning(request.result?.provisioning) ? (
                <button
                  onClick={handleRetry}
                  disabled={retryingId === request.id}
                  className="rounded border px-2 py-1 text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {retryingId === request.id ? '重试中' : '重试交付'}
                </button>
              ) : null}
              <button
                onClick={handleComplete}
                className="rounded border px-2 py-1 text-xs hover:bg-accent"
              >
                交付
              </button>
            </>
          ) : null}
          {request.instance ? <Tag color="default">实例：{request.instance.name}</Tag> : null}
        </div>
      </td>
    </tr>
  );
}
