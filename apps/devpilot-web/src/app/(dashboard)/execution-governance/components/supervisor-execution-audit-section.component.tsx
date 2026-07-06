'use client';

import { useTranslations } from 'next-intl';
import { SupervisorField, StatusBadge } from './ui-bits';
import {
  formatAuditRisk,
  formatExecutionAuditAction,
  readExecutionAuditStatus,
} from '../supervisor-orphan-audit-format.utils';
import { formatDate, shortId } from '../utils';
import type { ServerExecutionSupervisorSnapshot } from '../supervisor';

type ExecutionAuditVisibility = ServerExecutionSupervisorSnapshot['executionAuditVisibility'];

export function SupervisorExecutionAuditSection({
  auditVisibility,
}: {
  auditVisibility: ExecutionAuditVisibility;
}) {
  const t = useTranslations('executionGovernance');
  return (
    <div className="mt-4 border-t pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-medium text-foreground">Execution audit visibility</h4>
        <StatusBadge status={readExecutionAuditStatus(auditVisibility)} />
      </div>
      <div className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <SupervisorField
          label="recent"
          value={`${auditVisibility.totalRecent} events`}
        />
        <SupervisorField
          label="failed/blocked"
          value={`${auditVisibility.failedRecent}/${auditVisibility.blockedRecent}`}
        />
        <SupervisorField
          label="high risk"
          value={String(auditVisibility.highRiskRecent)}
        />
        <SupervisorField
          label="statuses"
          value={
            auditVisibility.statuses
              .slice(0, 3)
              .map((item) => `${item.status}:${item.count}`)
              .join(' · ') || '-'
          }
        />
        <SupervisorField
          label="risks"
          value={
            auditVisibility.risks
              .slice(0, 3)
              .map((item) => `${formatAuditRisk(item.risk)}:${item.count}`)
              .join(' · ') || '-'
          }
        />
        <SupervisorField
          label="top action"
          value={
            auditVisibility.actions[0]
              ? `${formatExecutionAuditAction(auditVisibility.actions[0].action)} · ${auditVisibility.actions[0].count}`
              : '-'
          }
        />
      </div>

      {auditVisibility.samples.length > 0 ? (
        <div className="mt-3 space-y-2 border-t pt-2 text-xs text-muted-foreground">
          {auditVisibility.samples.slice(0, 3).map((event) => (
            <div key={event.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {formatExecutionAuditAction(event.action)} · {event.status} ·{' '}
                  {formatAuditRisk(event.risk)}
                </span>
                <span className="font-mono">
                  {event.serverExecutionJobId
                    ? shortId(event.serverExecutionJobId)
                    : shortId(event.id)}
                </span>
              </div>
              <div className="mt-1">
                {event.metadata?.operationKey || event.summary || 'execution audit'} ·{' '}
                {event.server?.name || t('noServer')} · {formatDate(event.occurredAt)}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
