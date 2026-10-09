import { createHash } from 'node:crypto';
import yaml from 'js-yaml';
import { validateProjectSpec } from '../shared/spec-v2.js';
import { assertGitRepositoryUrl } from '../shared/git-policy.js';
import type { RepositorySource, RepositoryResolveOptions, RepositoryProvider, SourceSnapshot } from './repository-contracts.js';

export function repositoryDescriptor(source: RepositorySource, options: RepositoryResolveOptions = {}) {
  const url = assertGitRepositoryUrl(source.repoUrl, options);
  const parts = url.pathname.replace(/\/$/, '').replace(/\.git$/, '').slice(1).split('/');
  if (parts.length < 2 || parts.some(part => !part || part === '.' || part === '..' || /[%\\\u0000-\u0020]/.test(part))) throw new Error('Repository URL must identify one repository');
  const provider: RepositoryProvider = options.provider ?? source.provider ?? (url.hostname === 'github.com' ? 'github' : url.hostname === 'gitlab.com' ? 'gitlab' : 'generic');
  if (provider === 'github' && url.hostname !== 'github.com') throw new Error('GitHub provider API currently supports github.com; use generic HTTPS Git for other hosts');
  if ((provider === 'github' || provider === 'gitea') && parts.length !== 2) throw new Error('Provider repository URL requires owner and repository');
  if (!source.ref || !['branch', 'tag', 'commit'].includes(source.ref.kind) || typeof source.ref.value !== 'string'
    || source.ref.value.length > 256 || /[\u0000-\u0020~^:?*\[\\]/.test(source.ref.value) || source.ref.value.startsWith('-') || source.ref.value.includes('..')
    || !source.ref.value && source.ref.kind !== 'branch') throw new Error('Repository ref is invalid');
  if (source.ref.kind === 'commit' && !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(source.ref.value)) throw new Error('Commit must be a full SHA');
  const specPath = source.specPath || 'ship.yaml';
  if (specPath.length > 4096 || specPath.startsWith('/') || specPath.split('/').some(part => !part || part === '.' || part === '..') || /[\\\u0000-\u001f]/.test(specPath)) throw new Error('Definition path must remain inside the repository');
  return { source: { ...source, repoUrl: url.toString(), specPath }, url, parts, provider };
}
export type RepositoryDescriptor = ReturnType<typeof repositoryDescriptor>;
export function sourceSnapshot(descriptor: RepositoryDescriptor, commit: unknown, ref: string, content: string): SourceSnapshot {
  if (typeof commit !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(commit)) throw new Error('Repository provider did not return a fixed commit SHA');
  if (descriptor.source.ref.kind === 'commit' && commit.toLowerCase() !== descriptor.source.ref.value.toLowerCase()) throw new Error('Repository commit differs from the requested SHA');
  let raw: unknown; try { raw = descriptor.source.specPath.endsWith('.json') ? JSON.parse(content) : yaml.load(content); } catch { throw new Error('Repository definition is invalid YAML/JSON'); }
  const spec = validateProjectSpec(raw);
  return { repoUrl: descriptor.source.repoUrl, requestedRef: { kind: descriptor.source.ref.kind, value: ref }, commit: commit.toLowerCase(),
    specPath: descriptor.source.specPath, sourceRevision: descriptor.source.revision, provider: descriptor.provider,
    spec, specDigest: createHash('sha256').update(content).digest('hex'), appName: spec.name };
}
