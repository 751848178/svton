import type { DetectedService } from './repository-parser.types';
import {
  findRepositoryApplication,
  findRepositoryService,
  type ExistingRepositoryApplication,
} from './repository-suggestion-match.utils';

describe('repository suggestion existing object matching', () => {
  const application: ExistingRepositoryApplication = {
    id: 'application-picshare',
    name: 'Picshare App',
    repoPath: null,
    repositoryUrl: 'https://github.com/751848178/picshare.git',
    services: [
      service('service-admin', 'admin'),
      service('service-backend', 'backend'),
    ],
  };

  it.each([
    ['@picshare/admin', 'apps/admin', 'admin', 'service-admin'],
    ['@picshare/backend', 'apps/backend', 'backend', 'service-backend'],
  ])(
    'matches %s to the existing Picshare application and service',
    (name, path, role, serviceId) => {
      const detected = detectedService(name, path, role);
      const matchedApplication = findRepositoryApplication(
        [application],
        detected,
        application.repositoryUrl!,
      );
      const matchedService = findRepositoryService(
        matchedApplication,
        detected,
        'environment-dev',
      );
      expect(matchedApplication?.id).toBe(application.id);
      expect(matchedService?.id).toBe(serviceId);
    },
  );

  it('does not attach a repository-only proxy to an unrelated existing service', () => {
    const detected = detectedService('picshare-proxy', '.', 'service');
    expect(findRepositoryApplication(
      [application],
      detected,
      application.repositoryUrl!,
    )).toBeUndefined();
  });

  it('prefers an exact repoPath application over name heuristics', () => {
    const exact = {
      ...application,
      id: 'application-exact',
      name: 'Custom Backend',
      repoPath: 'apps/backend',
      services: [service('service-exact', 'backend')],
    };
    const matched = findRepositoryApplication(
      [application, exact],
      detectedService('@picshare/backend', 'apps/backend', 'backend'),
      application.repositoryUrl!,
    );
    expect(matched?.id).toBe('application-exact');
  });
});

function service(id: string, name: string) {
  return {
    id,
    name,
    environmentId: 'environment-dev',
    deployConfig: {},
    runtime: null,
    ports: null,
    metadata: null,
  };
}

function detectedService(name: string, path: string, role: string): DetectedService {
  return {
    key: path.split('/').pop() || name,
    name,
    path,
    role,
    deployable: true,
    artifactOnly: false,
    framework: [],
    versions: {},
    commands: {},
    ports: [],
    healthChecks: [],
    environment: [],
    databases: [],
    dependencies: [],
    container: { composeFiles: [], composeServices: [], dependsOn: [] },
    artifacts: [],
    evidence: [],
    warnings: [],
  };
}
