import { basename } from 'path';
import type { DetectedService } from './repository-parser.types';

export type ExistingRepositoryApplication = {
  id: string;
  name: string;
  repoPath: string | null;
  repositoryUrl: string | null;
  services: Array<{
    id: string;
    name: string;
    environmentId: string;
    deployConfig: unknown;
    runtime: string | null;
    ports: unknown;
    metadata: unknown;
  }>;
};

export function findRepositoryApplication(
  applications: ExistingRepositoryApplication[],
  detected: DetectedService,
  repositoryUrl: string,
): ExistingRepositoryApplication | undefined {
  return applications.find((item) => item.repoPath === detected.path)
    || applications.find((item) => namesMatch(item.name, detected))
    || applications.find((item) =>
      item.repositoryUrl === repositoryUrl
      && item.services.some((service) => namesMatch(service.name, detected)),
    );
}

export function findRepositoryService(
  application: ExistingRepositoryApplication | undefined,
  detected: DetectedService,
  environmentId?: string,
) {
  return application?.services.find((item) =>
    namesMatch(item.name, detected)
    && (!environmentId || item.environmentId === environmentId),
  );
}

function namesMatch(value: string, detected: DetectedService): boolean {
  const normalized = normalize(value);
  return [
    detected.name,
    detected.key,
    detected.role,
    basename(detected.path),
  ].some((candidate) => normalize(candidate) === normalized);
}

function normalize(value: string): string {
  return value
    .replace(/^@[^/]+\//, '')
    .replace(/^(?:picshare[-_])/, '')
    .trim()
    .toLowerCase();
}
