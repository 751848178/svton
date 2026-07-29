import {
  buildDeploymentRunHref,
  buildServerExecutionJobHref,
} from './release-run-deep-links.utils';

describe('release run deep links', () => {
  it('targets the exact deployment run inside its project deployment tab', () => {
    expect(buildDeploymentRunHref('project/1', 'run?1')).toBe(
      '/projects/project%2F1?tab=deployments&runId=run%3F1',
    );
  });

  it('targets the exact server execution job', () => {
    expect(buildServerExecutionJobHref('job?1')).toBe(
      '/execution-governance?jobId=job%3F1',
    );
  });
});
