import { RepositorySafeError } from './repository-analysis.types';
import { redactRepositoryText } from './repository-analysis-redact.utils';

export class RepositoryGitError extends Error {
  constructor(readonly detail: RepositorySafeError) {
    super(detail.message);
  }
}

export function mapGitFailure(
  error: unknown,
  secrets: string[] = [],
): RepositoryGitError {
  const raw = error instanceof Error ? error.message : String(error);
  const safe = redactRepositoryText(raw, secrets);
  if (/abort|timed?\s*out|timeout/i.test(safe)) {
    return new RepositoryGitError({
      code: 'REPOSITORY_TIMEOUT',
      message: '仓库响应超时',
      action: '请检查仓库网络可达性，或稍后重试。',
    });
  }
  if (/authentication|permission denied|could not read username|access denied|publickey/i.test(safe)) {
    return new RepositoryGitError({
      code: 'REPOSITORY_AUTH_FAILED',
      message: '仓库只读权限验证失败',
      action: '请确认凭据有效且至少具备仓库读取权限。',
    });
  }
  if (/not found|does not appear to be a git repository|repository .* not exist/i.test(safe)) {
    return new RepositoryGitError({
      code: 'REPOSITORY_NOT_FOUND',
      message: '未找到仓库或当前凭据无权查看',
      action: '请检查仓库地址和访问范围。',
    });
  }
  return new RepositoryGitError({
    code: 'REPOSITORY_GIT_FAILED',
    message: '无法读取仓库',
    action: '请检查仓库地址、分支和凭据后重试。',
  });
}
