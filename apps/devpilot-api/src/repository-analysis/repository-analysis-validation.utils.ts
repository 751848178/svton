import { BadRequestException } from '@nestjs/common';

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const SCP_STYLE = /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+:[A-Za-z0-9_./-]+$/;
const SAFE_BRANCH = /^(?!-)(?!.*(?:\.\.|\/\/|@\{|\\))[\w./-]+$/;

export function validateRepositoryUrl(value: string, allowLocal: boolean): string {
  const repositoryUrl = value.trim();
  if (!repositoryUrl || repositoryUrl.startsWith('-') || CONTROL_CHARACTERS.test(repositoryUrl)) {
    throw new BadRequestException(repositoryError(
      'REPOSITORY_URL_INVALID',
      '仓库地址格式无效',
      '请填写 HTTPS、SSH 仓库地址或允许范围内的本地仓库路径。',
    ));
  }
  if (SCP_STYLE.test(repositoryUrl)) return repositoryUrl;
  if (repositoryUrl.startsWith('/') || repositoryUrl.startsWith('file://')) {
    if (allowLocal) return repositoryUrl;
    throw new BadRequestException(repositoryError(
      'REPOSITORY_LOCAL_PATH_DISABLED',
      '当前环境未开放本地仓库解析',
      '请使用远程只读仓库地址，或由管理员显式配置本地仓库允许范围。',
    ));
  }
  try {
    const parsed = new URL(repositoryUrl);
    const httpsUserInfo = parsed.protocol === 'https:' && Boolean(parsed.username || parsed.password);
    const sshPassword = parsed.protocol === 'ssh:' && Boolean(parsed.password);
    if (!['https:', 'ssh:'].includes(parsed.protocol) || httpsUserInfo || sshPassword) {
      throw new Error('unsupported');
    }
    return repositoryUrl;
  } catch {
    throw new BadRequestException(repositoryError(
      'REPOSITORY_URL_INVALID',
      '仓库地址必须是无内嵌凭据的 HTTPS 或 SSH 地址',
      '请移除 URL 中的用户名或密码，并在凭据区域单独填写。',
    ));
  }
}

export function validateRepositoryBranch(value: string): string {
  const branch = value.trim();
  if (!branch || branch.length > 200 || !SAFE_BRANCH.test(branch)) {
    throw new BadRequestException(repositoryError(
      'REPOSITORY_BRANCH_INVALID',
      '分支名称格式无效',
      '请选择仓库返回的真实分支，或检查分支名称后重试。',
    ));
  }
  return branch;
}

export function repositoryError(code: string, message: string, action: string) {
  return { code, message, action };
}
