import { ServiceUnavailableException } from '@nestjs/common';
import type { RepositorySource, SourceSnapshot } from 'shipkit/platform';

const invalid = () => new ServiceUnavailableException('仓库登记快照无法验证，请恢复匹配的历史数据与密钥');
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));

/** Persisted metadata is trusted only within the registered repository revision. */
export function repositorySnapshot(value: unknown, source: RepositorySource, revision: number, appName: string | null): SourceSnapshot {
  if (!object(source) || !object(source.ref) || !object(value) || !object(value.requestedRef) || !object(value.spec) || typeof value.repoUrl !== 'string'
    || typeof source.repoUrl !== 'string' || !source.repoUrl || !Number.isSafeInteger(revision) || revision < 1 || typeof appName !== 'string' || !appName
    || !['branch', 'tag', 'commit'].includes(source.ref.kind) || typeof source.ref.value !== 'string' || !source.ref.value
    || typeof source.specPath !== 'string' || !source.specPath) throw invalid();
  let sameUrl = false;
  let expectedProvider: string;
  try {
    const url = new URL(source.repoUrl);
    sameUrl = new URL(value.repoUrl).toString().replace(/\/$/, '') === url.toString().replace(/\/$/, '');
    expectedProvider = source.provider ?? (url.hostname === 'github.com' ? 'github' : url.hostname === 'gitlab.com' ? 'gitlab' : 'generic');
  }
  catch { throw invalid(); }
  if (!sameUrl || value.specPath !== source.specPath || value.sourceRevision !== revision || source.revision !== revision
    || value.requestedRef.kind !== source.ref.kind || value.requestedRef.value !== source.ref.value
    || value.appName !== appName || value.spec.name !== appName || value.spec.schemaVersion !== 2
    || !object(value.spec.services) || !Object.keys(value.spec.services).length
    || typeof value.commit !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(value.commit)
    || typeof value.specDigest !== 'string' || !/^[a-f0-9]{64}$/i.test(value.specDigest)
    || value.provider !== expectedProvider
    || source.ref.kind === 'commit' && value.commit.toLowerCase() !== source.ref.value.toLowerCase()) throw invalid();
  return value as unknown as SourceSnapshot;
}
