import type { RepositoryDescriptor } from './repository-metadata.js';
import { sourceSnapshot } from './repository-metadata.js';
import type { RepositoryReader } from './repository-request.js';
import type { RepositoryResolveOptions } from './repository-contracts.js';

/** Provider endpoints: official GitHub contents/commits, GitLab repository files, Gitea repository APIs. */
export async function resolveProviderSource(d: RepositoryDescriptor, options: RepositoryResolveOptions, read: RepositoryReader) {
  const name = d.parts.map(encodeURIComponent).join('/');
  const base = d.provider === 'github' ? `https://api.github.com/repos/${name}`
    : d.provider === 'gitlab' ? `${d.url.origin}/api/v4/projects/${encodeURIComponent(d.parts.join('/'))}` : `${d.url.origin}/api/v1/repos/${name}`;
  const headers: Record<string, string> = { Accept: 'application/json', 'User-Agent': 'shipkit-repository-source' };
  if (options.token) {
    if (d.provider === 'gitlab') headers['PRIVATE-TOKEN'] = options.token;
    else headers.Authorization = `${d.provider === 'gitea' ? 'token' : 'Bearer'} ${options.token}`;
  }
  const get = (suffix: string) => read(new URL(`${base}${suffix}`), headers);
  let ref = d.source.ref.value;
  if (!ref) {
    const repository = await get('');
    if (typeof repository.default_branch !== 'string' || !repository.default_branch) throw new Error('Repository has no default branch');
    ref = repository.default_branch;
  }
  let commit: unknown;
  if (d.provider === 'github') {
    const typed = d.source.ref.kind === 'commit' ? ref : `${d.source.ref.kind === 'branch' ? 'heads' : 'tags'}/${ref}`;
    commit = (await get(`/commits/${encodeURIComponent(typed)}?per_page=1`)).sha;
  } else {
    const prefix = d.provider === 'gitlab' ? '/repository' : '';
    if (d.source.ref.kind === 'commit') commit = (await get(`${prefix}${d.provider === 'gitea' ? '/git' : ''}/commits/${encodeURIComponent(ref)}`))[d.provider === 'gitlab' ? 'id' : 'sha'];
    else {
      const value = await get(`${prefix}/${d.source.ref.kind === 'branch' ? 'branches' : 'tags'}/${encodeURIComponent(ref)}`);
      const details = value.commit as { id?: unknown; sha?: unknown } | undefined; commit = details?.id ?? details?.sha;
    }
  }
  if (typeof commit !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(commit)) throw new Error('Repository provider did not return a fixed commit SHA');
  const file = await get(d.provider === 'gitlab' ? `/repository/files/${encodeURIComponent(d.source.specPath)}?ref=${commit}`
    : `/contents/${d.source.specPath.split('/').map(encodeURIComponent).join('/')}?ref=${commit}`);
  if (d.provider !== 'gitlab' && file.type !== 'file' || file.encoding !== 'base64' || typeof file.content !== 'string') throw new Error('Repository definition must be a regular file');
  const content = Buffer.from(file.content.replace(/\s/g, ''), 'base64');
  if (content.length > Math.min(options.maxBytes ?? 1024 * 1024, 1024 * 1024)) throw new Error('Repository definition exceeds its byte limit');
  if (content.includes(0)) throw new Error('Repository definition must be UTF-8 text');
  let text: string; try { text = new TextDecoder('utf-8', { fatal: true }).decode(content); } catch { throw new Error('Repository definition must be UTF-8 text'); }
  return sourceSnapshot(d, commit, ref, text);
}
