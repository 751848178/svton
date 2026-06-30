/**
 * Live 占用列表
 *
 * 单一职责：渲染 ServerExecutionLease 表格 + 状态筛选。
 */

import { LoadingState, EmptyState } from '@svton/ui';
import { Metric, StatusBadge } from './ui-bits';
import type { ServerExecutionLease } from '../types';
import type { LeaseStats } from '../hooks/use-execution-governance';
import { readBlockedBy, formatDate } from '../utils';

interface LeaseListProps {
  leases: ServerExecutionLease[];
  loading: boolean;
  leaseStatus: string;
  onLeaseStatusChange: (status: string) => void;
  stats: LeaseStats;
}

export function LeaseList({
  leases,
  loading,
  leaseStatus,
  onLeaseStatusChange,
  stats,
}: LeaseListProps) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Live 占用</h2>
          <p className="text-sm text-muted-foreground">ServerExecutionLease</p>
        </div>
        <label className="block w-44 text-sm">
          <span className="mb-1 block font-medium">状态</span>
          <select
            value={leaseStatus}
            onChange={(e) => onLeaseStatusChange(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="running">运行中</option>
            <option value="blocked">已阻塞</option>
            <option value="completed">已完成</option>
            <option value="failed">失败</option>
            <option value="expired">已过期</option>
            <option value="all">全部</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Metric
          label="当前列表"
          value={stats.total}
        />
        <Metric
          label="运行中"
          value={stats.running}
        />
        <Metric
          label="已阻塞"
          value={stats.blocked}
        />
        <Metric
          label="已过期"
          value={stats.expired}
        />
        <Metric
          label="失败"
          value={stats.failed}
        />
      </div>

      {loading ? (
        <LoadingState text="加载中..." />
      ) : leases.length === 0 ? (
        <EmptyState
          text="暂无执行占用记录"
          description="Server executor live 执行或阻塞后会在这里出现"
        />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">服务器</th>
                <th className="px-4 py-3 font-medium">操作</th>
                <th className="px-4 py-3 font-medium">执行器</th>
                <th className="px-4 py-3 font-medium">申请人</th>
                <th className="px-4 py-3 font-medium">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {leases.map((lease) => (
                <tr key={lease.id}>
                  <td className="px-4 py-3">
                    <StatusBadge status={lease.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{lease.server?.name || '未关联服务器'}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {lease.server?.host || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{lease.operationKey}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {readBlockedBy(lease.metadata)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{lease.adapterKey}</div>
                    <div className="text-xs text-muted-foreground">{lease.transport}</div>
                  </td>
                  <td className="px-4 py-3">{lease.actor?.name || lease.actor?.email || '-'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <div>占用：{formatDate(lease.acquiredAt)}</div>
                    <div>释放：{formatDate(lease.releasedAt)}</div>
                    <div>过期：{formatDate(lease.expiresAt)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
