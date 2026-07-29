'use client';

import { Button } from '@svton/ui';
import Link from 'next/link';
import { ErrorBanner } from '@/components/ui';
import { RepositoryConnectCard } from '../repository-connect-card';
import { RepositoryRunPanel } from '../repository-run-panel';
import { RepositorySuggestionReview } from '../repository-suggestion-review';
import type { RepositoryAnalysisHook } from '../../hooks/use-repository-analysis.hooks';

export function RepositoryTab({
  analysis,
  onSelectRun,
}: {
  analysis: RepositoryAnalysisHook;
  onSelectRun: (runId: string) => void;
}) {
  return (
    <div className="space-y-6">
      {analysis.error ? (
        <ErrorBanner message={analysis.error} onRetry={() => void analysis.load()} retryLabel="重试" />
      ) : null}
      <RepositoryConnectCard analysis={analysis} onRunCreated={onSelectRun} />
      {analysis.state.connection?.status === 'connected' && analysis.runs.length > 0 ? (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            disabled={analysis.active || analysis.mutating}
            onClick={async () => onSelectRun((await analysis.start()).id)}
          >
            基于当前 commit 重新解析
          </Button>
        </div>
      ) : null}
      <RepositoryRunPanel analysis={analysis} onSelectRun={onSelectRun} />
      <RepositorySuggestionReview analysis={analysis} />
      {analysis.selectedRun ? (
        <div className="flex justify-end">
          <Link
            className="inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted"
            href={`/audit-events?projectId=${encodeURIComponent(
              analysis.projectId,
            )}&category=repository_analysis`}
          >
            查看仓库分析审计事件
          </Link>
        </div>
      ) : null}
    </div>
  );
}
