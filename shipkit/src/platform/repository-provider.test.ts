import test from 'node:test';
import assert from 'node:assert/strict';
import { repositoryDescriptor } from './repository-metadata.js';
import { resolveProviderSource } from './repository-provider.js';
import type { RepositorySource } from './repository-contracts.js';
import { assertGitRepositoryUrl, privateGitAddress } from '../shared/git-policy.js';

const sha = 'a'.repeat(40), spec = 'schemaVersion: 2\nname: monorepo\nservices:\n  api:\n    dockerfile: apps/api/Dockerfile\n    context: .\n';
const encoded = Buffer.from(spec).toString('base64');
const source = (kind: 'branch' | 'tag' | 'commit', value: string): RepositorySource => ({ repoUrl: 'https://github.com/owner/project.git', ref: { kind, value }, specPath: 'deploy/ship.yaml', revision: 3 });

test('GitHub resolves the actual default branch and reads only a fixed SHA definition without a local checkout', async () => {
  const calls: string[] = [], d = repositoryDescriptor(source('branch', ''));
  const result = await resolveProviderSource(d, { token: 'unit-private-token' }, async (url, headers) => {
    calls.push(url.toString()); assert.equal(headers.Authorization, 'Bearer unit-private-token');
    if (url.pathname.endsWith('/project')) return { default_branch: 'trunk' };
    if (url.pathname.includes('/commits/')) return { sha };
    assert.equal(url.searchParams.get('ref'), sha); return { type: 'file', encoding: 'base64', content: encoded };
  });
  assert.equal(calls.length, 3); assert(calls[1]!.includes('heads%2Ftrunk')); assert(calls[2]!.includes('/contents/deploy/ship.yaml'));
  assert.equal(result.commit, sha); assert.deepEqual(result.requestedRef, { kind: 'branch', value: 'trunk' });
  assert.equal(result.spec.services.api?.context, '.'); assert.equal(result.spec.services.api?.dockerfile, 'apps/api/Dockerfile');
  assert.equal(result.appName, 'monorepo'); assert.equal(result.sourceRevision, 3); assert(!JSON.stringify(result).includes('unit-private-token'));
});
test('branch and tag with identical names remain distinct, and a requested commit cannot be redirected', async () => {
  for (const kind of ['branch', 'tag'] as const) {
    const urls: string[] = [];
    await resolveProviderSource(repositoryDescriptor(source(kind, 'same')), {}, async url => {
      urls.push(url.toString()); return url.pathname.includes('/commits/') ? { sha } : { type: 'file', encoding: 'base64', content: encoded };
    });
    assert(urls[0]!.includes(`${kind === 'branch' ? 'heads' : 'tags'}%2Fsame`));
  }
  await assert.rejects(resolveProviderSource(repositoryDescriptor(source('commit', 'b'.repeat(40))), {}, async url =>
    url.pathname.includes('/commits/') ? { sha } : { type: 'file', encoding: 'base64', content: encoded }), /differs/);
});
test('GitLab nested namespace and Gitea providers use typed refs and metadata content endpoints', async () => {
  for (const provider of ['gitlab', 'gitea'] as const) {
    const repoUrl = provider === 'gitlab' ? 'https://gitlab.com/group/subgroup/repo.git' : 'https://gitea.example/owner/repo';
    const urls: string[] = [], d = repositoryDescriptor({ ...source('tag', 'v1'), repoUrl, provider }, { allowedHosts: ['gitlab.com', 'gitea.example'] });
    const result = await resolveProviderSource(d, { token: 'unit-token' }, async (url, headers) => {
      urls.push(url.toString());
      assert.equal(provider === 'gitlab' ? headers['PRIVATE-TOKEN'] : headers.Authorization, provider === 'gitlab' ? 'unit-token' : 'token unit-token');
      return url.pathname.includes('/tags/') ? { commit: { id: sha } } : { type: 'file', encoding: 'base64', content: encoded };
    });
    assert.equal(result.commit, sha); assert(urls[0]!.includes('/tags/v1'));
    if (provider === 'gitlab') assert(urls[1]!.includes('group%2Fsubgroup%2Frepo/repository/files/deploy%2Fship.yaml'));
    else assert(urls[1]!.includes('/api/v1/repos/owner/repo/contents/deploy/ship.yaml'));
  }
});
test('repository URLs, definitions, paths and permissions fail closed without a transport fallback', async () => {
  for (const repoUrl of ['http://github.com/owner/repo', 'https://user:token@github.com/owner/repo', 'https://evil.example/owner/repo', 'https://github.com/owner/repo?token=secret']) assert.throws(() => repositoryDescriptor({ ...source('branch', 'main'), repoUrl }));
  for (const specPath of ['../ship.yaml', '/ship.yaml', 'deploy/../../ship.yaml']) assert.throws(() => repositoryDescriptor({ ...source('branch', 'main'), specPath }));
  assert.throws(() => repositoryDescriptor(source('branch', '--upload-pack=evil')));
  assert.throws(() => repositoryDescriptor(source('commit', 'short')));
  await assert.rejects(resolveProviderSource(repositoryDescriptor(source('branch', 'main')), {}, async url => url.pathname.includes('/commits/') ? { sha } : { type: 'symlink', encoding: 'base64', content: encoded }), /regular file/);
  await assert.rejects(resolveProviderSource(repositoryDescriptor(source('branch', 'main')), { maxBytes: 10 }, async url => url.pathname.includes('/commits/') ? { sha } : { type: 'file', encoding: 'base64', content: encoded }), /byte limit/);
  await assert.rejects(resolveProviderSource(repositoryDescriptor(source('branch', 'main')), {}, async () => { throw new Error('read permission denied'); }), /permission/);
  assert.equal(assertGitRepositoryUrl('https://gitea.example/owner/repo', { allowedHosts: ['gitea.example'] }).hostname, 'gitea.example');
  for (const address of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '192.168.1.1', '::1', 'fd00::1']) assert(privateGitAddress(address));
  assert(!privateGitAddress('93.184.216.34'));
});
