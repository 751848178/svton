import { BadRequestException } from '@nestjs/common';
import type { RepositorySource } from 'shipkit/platform';
import { stringField } from './project-input.dto.js';

export function repositoryInput(value: unknown, revision = 1): RepositorySource {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('需要仓库配置');
  const body = value as Record<string, unknown>;
  const repoUrl = stringField(body.url ?? body.repoUrl, '仓库地址', true)!;
  let url: URL;
  try { url = new URL(repoUrl); } catch { throw new BadRequestException('仓库地址需要完整 HTTPS URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new BadRequestException('仓库地址只接受无凭据 HTTPS URL');
  const ref = body.ref as Record<string, unknown> | undefined;
  if (!ref || !['branch', 'tag', 'commit'].includes(String(ref.kind)) || typeof ref.value !== 'string' || ref.value.length > 256 || /[\u0000-\u0020]/.test(ref.value) || ref.value.startsWith('-')) {
    throw new BadRequestException('需要有效的分支、标签或 commit');
  }
  if (!ref.value && ref.kind !== 'branch') throw new BadRequestException('标签或 commit 不可为空');
  const specPath = stringField(body.specPath, '发布定义路径') ?? 'ship.yaml';
  if (specPath.startsWith('/') || specPath.split(/[\\/]/).includes('..') || specPath.includes('\\')) throw new BadRequestException('发布定义必须为仓库内相对路径');
  const provider = body.provider as RepositorySource['provider'];
  if (provider && !['github', 'gitlab', 'gitea', 'generic'].includes(provider)) throw new BadRequestException('仓库类型无效');
  return { repoUrl, ref: { kind: ref.kind as RepositorySource['ref']['kind'], value: ref.value }, specPath, provider, revision };
}

export function repositoryToken(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string' || !value || value.length > 8192 || /[\r\n\u0000]/.test(value)) throw new BadRequestException('仓库凭据无效；留空保留，明确清除需传 null');
  return value;
}

export function repositoryUsername(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string' || !value || value.length > 256 || /[\s\u0000]/.test(value)) throw new BadRequestException('Git 访问用户名无效；留空保留，明确清除需传 null');
  return value;
}

export function repositoryView(source: RepositorySource) {
  return { url: source.repoUrl, ref: source.ref, specPath: source.specPath, provider: source.provider, revision: source.revision };
}
