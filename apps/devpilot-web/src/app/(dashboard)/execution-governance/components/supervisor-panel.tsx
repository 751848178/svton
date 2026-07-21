/**
 * Supervisor 面板
 *
 * 单一职责：渲染 12 项指标(默认折叠,异常时自动展开) +
 * queue worker、Agent readiness、worker owners 三张概览大卡。
 * 加载失败用 ErrorBanner(错误语义),仅无数据时才用 EmptyState。
 */

'use client';

import { useTranslations } from 'next-intl';
import { LoadingState, EmptyState } from '@svton/ui';
import { ErrorBanner } from '@/components/ui';
import { CollapsibleGroup } from './collapsible-group';
import { SupervisorAgentReadinessCard } from './supervisor-agent-readiness-card.component';
import { SupervisorSummary } from './supervisor-summary.component';
import { SupervisorWorkerOwnersCard } from './supervisor-worker-owners-card.component';
import { SupervisorWorkerProcessCard } from './supervisor-worker-process-card.component';
import { countSupervisorIssues } from '../supervisor-health.utils';
import type { ServerExecutionSupervisorSnapshot } from '../supervisor';

interface SupervisorPanelProps {
  supervisor: ServerExecutionSupervisorSnapshot | null;
  loading: boolean;
  error: string;
  onRetry?: () => void;
}

export function SupervisorPanel({ supervisor, loading, error, onRetry }: SupervisorPanelProps) {
  const t = useTranslations('executionGovernance');
  const tc = useTranslations('common');
  if (loading) return <LoadingState text={tc('loading')} />;
  if (!supervisor) {
    if (error) {
      return (
        <ErrorBanner
          message={error}
          onRetry={onRetry}
          retryLabel={tc('retry')}
        />
      );
    }
    return <EmptyState text={t('supervisorUnavailable')} />;
  }

  return (
    <div className="space-y-4">
      <CollapsibleGroup
        title={t('groupSupervisor')}
        issueCount={countSupervisorIssues(supervisor)}
      >
        <SupervisorSummary supervisor={supervisor} />
      </CollapsibleGroup>

      <div className="grid gap-4 lg:grid-cols-3">
        <SupervisorWorkerProcessCard supervisor={supervisor} />
        <SupervisorAgentReadinessCard supervisor={supervisor} />
        <SupervisorWorkerOwnersCard supervisor={supervisor} />
      </div>
    </div>
  );
}
