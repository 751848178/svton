/**
 * 审计事件表格
 *
 * 单一职责：渲染事件列表表格。
 */

import { StatusTag } from '@/components/ui';
import type { AuditEvent } from '../types';
import { categoryLabels, statusLabels, riskLabels } from '../constants';
import { formatTarget, formatRunRef, formatDateTime } from '../utils';

interface EventTableProps {
  events: AuditEvent[];
}

export function EventTable({ events }: EventTableProps) {
  return (
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
            <EventRow
              key={event.id}
              event={event}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EventRow({ event }: { event: AuditEvent }) {
  return (
    <tr className="align-top hover:bg-muted/30">
      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
        {formatDateTime(event.occurredAt)}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{categoryLabels[event.category] || event.category}</span>
          <StatusTag
            status={event.risk}
            variant="risk"
            label={riskLabels[event.risk] || event.risk}
          />
        </div>
        <div className="mt-1 font-mono text-xs text-muted-foreground">{event.action}</div>
        {event.summary ? (
          <div className="mt-1 text-xs text-muted-foreground">{event.summary}</div>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <div className="font-medium">{formatTarget(event)}</div>
        <div className="mt-1 font-mono text-xs text-muted-foreground">
          {event.targetType}
          {event.targetId ? ` · ${event.targetId}` : ''}
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
        <StatusTag
          status={event.status}
          label={statusLabels[event.status] || event.status}
        />
        <div className="mt-2 text-xs text-muted-foreground">{formatRunRef(event)}</div>
      </td>
    </tr>
  );
}
