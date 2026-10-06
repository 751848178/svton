import type {
  RepositoryAnalysisStage,
  RepositoryRunStatus,
} from '../types/repository-analysis.types';

export function repositoryRunStatusLabel(status: RepositoryRunStatus): string {
  return (
    {
      queued: '排队中',
      running: '解析中',
      succeeded: '解析成功',
      failed: '解析失败',
      cancelled: '已取消',
    } satisfies Record<RepositoryRunStatus, string>
  )[status];
}

export function repositoryStageLabel(stage: RepositoryAnalysisStage['name']): string {
  return (
    (
      {
        resolve: '固定仓库快照',
        checkout: '只读检出',
        inventory: '文件盘点',
        detect: '技术栈与服务检测',
        suggest: '生成可审建议',
        cleanup: '隔离目录清理',
      } satisfies Record<string, string>
    )[stage] ?? stage
  );
}

export function repositoryRunStatusClass(status: RepositoryRunStatus): string {
  if (status === 'failed') return 'text-destructive';
  if (status === 'succeeded') return 'text-emerald-700';
  if (status === 'queued' || status === 'running') return 'text-sky-700';
  return 'text-muted-foreground';
}
