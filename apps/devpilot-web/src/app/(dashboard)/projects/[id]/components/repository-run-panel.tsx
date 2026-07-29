'use client';

import { Button, Card, EmptyState, LoadingState } from '@svton/ui';
import type { RepositoryAnalysisHook } from '../hooks/use-repository-analysis.hooks';
import type {
  RepositoryAnalysisRun,
  RepositoryAnalysisStage,
} from '../types/repository-analysis.types';

export function RepositoryRunPanel({
  analysis,
  onSelectRun,
}: {
  analysis: RepositoryAnalysisHook;
  onSelectRun: (runId: string) => void;
}) {
  if (analysis.loading) return <LoadingState text="正在加载解析记录…" />;
  if (analysis.runs.length === 0) {
    return <EmptyState text="连接仓库后，这里会显示解析阶段、证据和失败恢复动作。" />;
  }
  const run = analysis.selectedRun;
  return (
    <section className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <Card className="space-y-2">
        <h2 className="font-semibold">解析历史</h2>
        <div className="space-y-2">
          {analysis.runs.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`w-full rounded-md border p-3 text-left text-sm ${
                item.id === run?.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'
              }`}
              onClick={() => onSelectRun(item.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{statusLabel(item.status)}</span>
                <span className="font-mono text-xs">{item.commitSha.slice(0, 8)}</span>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {item.branch} · {new Date(item.createdAt).toLocaleString()}
              </p>
            </button>
          ))}
        </div>
      </Card>
      {run ? <RunDetail analysis={analysis} run={run} /> : null}
    </section>
  );
}

function RunDetail({
  analysis,
  run,
}: {
  analysis: RepositoryAnalysisHook;
  run: RepositoryAnalysisRun;
}) {
  const active = run.status === 'queued' || run.status === 'running';
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{statusLabel(run.status)}</h2>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {run.branch}@{run.commitSha}
          </p>
        </div>
        <div className="flex gap-2">
          {active ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={analysis.mutating}
              onClick={() => void analysis.cancel(run.id)}
            >
              取消
            </Button>
          ) : null}
          {run.status === 'failed' || run.status === 'cancelled' ? (
            <Button size="sm" disabled={analysis.mutating} onClick={() => void analysis.retry(run.id)}>
              重试
            </Button>
          ) : null}
        </div>
      </div>
      {run.errorMessage ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="font-medium">{run.errorMessage}</p>
          {run.errorAction ? <p className="mt-1 text-muted-foreground">{run.errorAction}</p> : null}
          {run.errorCode ? <code className="mt-2 block text-xs">{run.errorCode}</code> : null}
        </div>
      ) : null}
      <ol className="space-y-2">
        {(run.stages || []).map((stage) => <StageRow key={stage.id} stage={stage} />)}
      </ol>
      {run.warnings?.length ? (
        <ul className="list-disc pl-5 text-sm text-amber-700">
          {run.warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      ) : null}
    </Card>
  );
}

function StageRow({ stage }: { stage: RepositoryAnalysisStage }) {
  const evidence = Array.isArray(stage.evidence) ? stage.evidence : [];
  const logs = Array.isArray(stage.logs) ? stage.logs : [];
  return (
    <li className="rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">{stageLabel(stage.name)}</span>
        <span className={`text-xs ${stage.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>
          {statusLabel(stage.status)}
          {stage.durationMs != null ? ` · ${stage.durationMs}ms` : ''}
        </span>
      </div>
      {logs.length ? (
        <p className="mt-1 text-sm text-muted-foreground">{logs.map(String).join('；')}</p>
      ) : null}
      {stage.errorMessage ? <p className="mt-1 text-sm text-destructive">{stage.errorMessage}</p> : null}
      {evidence.length ? (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-primary">查看 {evidence.length} 条证据</summary>
          <ul className="mt-2 space-y-1">
            {evidence.slice(0, 20).map((item, index) => (
              <li key={`${item.file}-${index}`} className="break-all font-mono">
                {item.file} · {item.detail}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}

function statusLabel(status: string): string {
  return {
    queued: '排队中',
    running: '解析中',
    succeeded: '解析成功',
    failed: '解析失败',
    cancelled: '已取消',
  }[status] || status;
}

function stageLabel(stage: string): string {
  return {
    resolve: '固定仓库快照',
    checkout: '只读检出',
    inventory: '文件盘点',
    detect: '技术栈与服务检测',
    suggest: '生成可审建议',
    cleanup: '隔离目录清理',
  }[stage] || stage;
}
