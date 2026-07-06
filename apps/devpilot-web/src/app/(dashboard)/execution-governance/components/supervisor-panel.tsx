/**
 * Supervisor 面板
 *
 * 单一职责：渲染 queue worker、Agent readiness、worker owners 三列概览。
 */

'use client';

import { useTranslations } from 'next-intl';
import { LoadingState, EmptyState } from '@svton/ui';
import { SupervisorAgentReadinessCard } from './supervisor-agent-readiness-card.component';
import { SupervisorSummary } from './supervisor-summary.component';
import { SupervisorWorkerOwnersCard } from './supervisor-worker-owners-card.component';
import { SupervisorWorkerProcessCard } from './supervisor-worker-process-card.component';
import type { ServerExecutionSupervisorSnapshot } from '../supervisor';

interface SupervisorPanelProps {
  supervisor: ServerExecutionSupervisorSnapshot | null;
  loading: boolean;
  error: string;
}

export function SupervisorPanel({ supervisor, loading, error }: SupervisorPanelProps) {
  const t = useTranslations('executionGovernance');
  const tc = useTranslations('common');
  if (loading) return <LoadingState text={tc('loading')} />;
  if (!supervisor) {
    return <EmptyState text={error || t('supervisorUnavailable')} />;
  }

  return (
    <>
      <SupervisorSummary supervisor={supervisor} />

      <div className="grid gap-4 lg:grid-cols-3">
        <SupervisorWorkerProcessCard supervisor={supervisor} />
        <SupervisorAgentReadinessCard supervisor={supervisor} />
        <SupervisorWorkerOwnersCard supervisor={supervisor} />
      </div>
    </>
  );
}
