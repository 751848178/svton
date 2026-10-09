import type { RepositoryInput } from './source-contracts';

export const emptyRepository: RepositoryInput = { url: '', ref: { kind: 'branch', value: '' }, specPath: 'ship.yaml' };
export function repositoryInput(value: RepositoryInput): RepositoryInput {
  let url: URL;
  try { url = new URL(value.url.trim()); } catch { throw new Error('请输入完整的 HTTPS 仓库地址。'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search) throw new Error('仓库地址须为不含凭据的 HTTPS 地址。');
  if (value.ref.kind !== 'branch' && !value.ref.value.trim()) throw new Error('请填写标签或提交。');
  return { url: url.toString(), ref: { kind: value.ref.kind, value: value.ref.value.trim() }, specPath: value.specPath?.trim() || 'ship.yaml', ...(value.provider ? { provider: value.provider } : {}) };
}
