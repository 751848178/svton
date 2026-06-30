/**
 * Git 域常量
 *
 * 单一职责：仅放提供商标签与权限说明。
 */

import type { GitProvider } from './types';

export const providerNames: Record<string, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  gitee: 'Gitee',
};

/** 各提供商的 Access Token 权限要求说明。 */
export const tokenPermissionHints: Record<GitProvider, string> = {
  github: '需要 repo 权限的 Personal Access Token',
  gitlab: '需要 api 权限的 Personal Access Token',
  gitee: '需要 projects 权限的私人令牌',
};

export const PROVIDER_OPTIONS: Array<{ value: GitProvider; label: string }> = [
  { value: 'github', label: 'GitHub' },
  { value: 'gitlab', label: 'GitLab' },
  { value: 'gitee', label: 'Gitee' },
];
