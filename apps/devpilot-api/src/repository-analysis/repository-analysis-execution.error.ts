import { RepositorySafeError } from './repository-analysis.types';
import { RepositoryGitError } from './repository-git-error.utils';

export class RepositoryAnalysisExecutionError extends Error {
  constructor(readonly detail: RepositorySafeError) {
    super(detail.message);
  }
}

export function analysisError(code: string, message: string, action: string) {
  return new RepositoryAnalysisExecutionError({ code, message, action });
}

export function repositoryAnalysisErrorDetail(
  error: unknown,
  cancelled: boolean,
  timedOut: boolean,
): RepositorySafeError {
  if (timedOut) return {
    code: 'REPOSITORY_ANALYSIS_TIMEOUT',
    message: '代码解析超时',
    action: '请缩小仓库规模、检查网络后重试，或由管理员调整解析超时上限。',
  };
  if (cancelled) return {
    code: 'REPOSITORY_ANALYSIS_CANCELLED',
    message: '解析已取消',
    action: '可从运行历史重新发起解析。',
  };
  if (error instanceof RepositoryAnalysisExecutionError || error instanceof RepositoryGitError) {
    return error.detail;
  }
  return {
    code: 'REPOSITORY_ANALYSIS_FAILED',
    message: '代码解析失败',
    action: '请查看失败阶段证据，修复仓库配置后重试。',
  };
}
