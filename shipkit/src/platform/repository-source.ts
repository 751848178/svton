import type { RepositorySource, RepositoryResolveOptions } from './repository-contracts.js';
import { repositoryDescriptor } from './repository-metadata.js';
import { repositoryReader } from './repository-request.js';
import { resolveProviderSource } from './repository-provider.js';
import { resolveGenericSource } from './repository-generic.js';

export async function resolveRepositorySource(source: RepositorySource, options: RepositoryResolveOptions = {}) {
  const descriptor = repositoryDescriptor(source, options);
  if (descriptor.provider === 'generic') return resolveGenericSource(descriptor, options);
  return resolveProviderSource(descriptor, options, repositoryReader(options, {
    deadline: Date.now() + Math.min(options.timeoutMs ?? 30000, 120000), remaining: options.maxBytes ?? 2 * 1024 * 1024,
  }));
}
