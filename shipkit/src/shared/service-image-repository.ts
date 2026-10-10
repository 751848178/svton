// Registry repository leaves are independent of runtime service identities.
import { NAME_RE, SpecError } from './spec-schema.js';

type RepositorySpec = { imageRepository?: unknown };

export function serviceImageRepository(name: string, service: RepositorySpec): string {
  const repository = Object.hasOwn(service, 'imageRepository') ? service.imageRepository : name;
  if (typeof repository !== 'string' || !NAME_RE.test(repository)) {
    throw new SpecError(`must be a repository leaf matching ${NAME_RE}`, `services.${name}.imageRepository`);
  }
  return repository;
}

/** Shared tags must never let two service builds overwrite one local image. */
export function assertUniqueImageRepositories(services: Record<string, RepositorySpec>): void {
  const owners = new Map<string, string>();
  for (const [name, service] of Object.entries(services)) {
    const repository = serviceImageRepository(name, service);
    const previous = owners.get(repository);
    if (previous !== undefined) {
      throw new SpecError(`effective repository '${repository}' conflicts with service '${previous}'`, `services.${name}.imageRepository`);
    }
    owners.set(repository, name);
  }
}
