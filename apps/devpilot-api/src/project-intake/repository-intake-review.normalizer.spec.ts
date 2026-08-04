import { BadRequestException } from '@nestjs/common';
import { normalizeRepositoryIntakeReview } from './repository-intake-review.normalizer';

const overview = {
  projectType: 'web_application',
  architecture: 'monorepo',
  packageManager: 'pnpm',
  deploymentPlan: 'container',
};
const component = {
  name: 'api', path: 'apps/api', type: 'backend_service',
  buildOutput: 'oci_image', runMethod: 'container',
};

function run() {
  return {
    suggestions: [
      { id: 'repo', kind: 'project_repository', proposedValue: { intakeContract: { overview } } },
      { id: 'env', kind: 'environment', proposedValue: { key: 'production' } },
      {
        id: 'api', kind: 'application_service',
        proposedValue: { metadata: { repositoryAnalysis: { intakeContract: component } } },
      },
      { id: 'resource', kind: 'resource_requirement', proposedValue: { requirements: ['mysql'] } },
    ],
  } as never;
}

describe('repository intake review normalizer', () => {
  it('derives kinds server-side and only overlays allowed product fields', () => {
    const result = normalizeRepositoryIntakeReview(run(), { items: [
      { suggestionId: 'repo', decision: 'edit', overrides: { architecture: 'single_repository' } },
      { suggestionId: 'env', decision: 'accept' },
      { suggestionId: 'api', decision: 'edit', overrides: { name: 'backend', path: 'services/api' } },
      { suggestionId: 'resource', decision: 'reject' },
    ] });
    expect(result.decisions[0]).toMatchObject({
      decision: 'edit',
      value: { intakeContract: { overview: { architecture: 'single_repository' } } },
    });
    expect(result.decisions[2]).toMatchObject({
      value: {
        applicationName: 'backend', serviceName: 'backend', repoPath: 'services/api',
        deployConfig: { workingDirectory: 'services/api' },
      },
    });
  });

  it('rejects the required repository and cross-kind fields before writes', () => {
    expect(() => normalizeRepositoryIntakeReview(run(), { items: [
      { suggestionId: 'repo', decision: 'reject' },
      { suggestionId: 'env', decision: 'accept' },
      { suggestionId: 'api', decision: 'accept' },
      { suggestionId: 'resource', decision: 'reject' },
    ] })).toThrow(BadRequestException);
    expect(() => normalizeRepositoryIntakeReview(run(), { items: [
      { suggestionId: 'repo', decision: 'edit', overrides: { path: 'forged' } },
      { suggestionId: 'env', decision: 'accept' },
      { suggestionId: 'api', decision: 'accept' },
      { suggestionId: 'resource', decision: 'reject' },
    ] })).toThrow(BadRequestException);
  });

  it('returns structured blockers for rejected dependencies', () => {
    try {
      normalizeRepositoryIntakeReview(run(), { items: [
        { suggestionId: 'repo', decision: 'accept' },
        { suggestionId: 'env', decision: 'reject' },
        { suggestionId: 'api', decision: 'accept' },
        { suggestionId: 'resource', decision: 'reject' },
      ] });
      throw new Error('expected dependency error');
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'REPOSITORY_INTAKE_DEPENDENCY_BLOCKED', blockers: ['api'],
      });
    }
  });
});
