import { detectIntakeComponent, detectIntakeOverview } from './repository-intake-detection.utils';

describe('repository intake detection', () => {
  const service = (name: string, role: string, path: string, dockerfile?: string) => ({
    key: name, name, role, path, deployable: true, artifactOnly: false,
    framework: [], versions: {}, commands: {}, ports: [], healthChecks: [], environment: [],
    databases: [], dependencies: [], artifacts: ['dist/index.js'], evidence: [], warnings: [],
    container: { dockerfile, composeFiles: [], composeServices: [], dependsOn: [] },
  });

  it('projects monorepo, package manager, deployment and component fields', () => {
    const api = service('api', 'backend', 'apps/api', 'apps/api/Dockerfile');
    const result = {
      repository: { monorepo: true, packageManager: 'pnpm', lockfiles: [], workspacePatterns: [] },
      services: [service('web', 'frontend', 'apps/web'), api],
      composeCandidates: [], resourceRequirements: [], warnings: [], evidence: [],
    } as never;
    expect(detectIntakeOverview(result)).toEqual({
      projectType: 'mixed_application', architecture: 'monorepo',
      packageManager: 'pnpm', deploymentPlan: 'container',
    });
    expect(detectIntakeComponent(api as never)).toMatchObject({
      name: 'api', path: 'apps/api', type: 'backend_service',
      buildOutput: 'oci_image', runMethod: 'container',
    });
  });

  it('classifies generic parser services from framework and worker evidence', () => {
    const web = { ...service('web', 'service', 'apps/web'), framework: ['Next.js'] };
    const worker = service('jobs-worker', 'service', 'apps/jobs');
    expect(detectIntakeComponent(web as never)).toMatchObject({
      type: 'frontend_site', runMethod: 'process',
    });
    expect(detectIntakeComponent(worker as never)).toMatchObject({
      type: 'worker', runMethod: 'worker',
    });
  });
});
