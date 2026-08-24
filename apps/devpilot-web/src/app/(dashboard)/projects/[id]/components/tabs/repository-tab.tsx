'use client';

import Link from 'next/link';
import { Button, ErrorBanner, LinkButton } from '@/components/ui';
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
        <ErrorBanner
          message={analysis.error}
          onRetry={() => void analysis.load()}
          retryLabel="重试"
        />
      ) : null}
      <RepositoryConnectCard
        analysis={analysis}
        onRunCreated={onSelectRun}
      />
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
      <RepositoryRunPanel
        analysis={analysis}
        onSelectRun={onSelectRun}
      />
      <RepositorySuggestionReview analysis={analysis} />
      {/*
        INFO-7：底部审计链接与「查看仓库身份审计」（修订默认分支区）指向完全相同的
        地址，冗余；保留身份卡内那个上下文入口即可。
      */}
    </div>
  );
}
