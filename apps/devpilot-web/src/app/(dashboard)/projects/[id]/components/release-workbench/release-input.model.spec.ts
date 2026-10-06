import { describe, expect, it } from 'vitest';
import type { ProjectDeliverySummary } from '../../types/project-delivery-summary.types';
import type { ReleaseOrderDetail } from '../../types/release-order.types';
import { buildReleaseInputFacts } from './release-input.model';

describe('buildReleaseInputFacts', () => {
  it('keeps only version, source branch, and the staging target', () => {
    const facts = buildReleaseInputFacts({ detail, projectSummary: summary });
    expect(facts).toEqual({
      releaseVersion: '1.0.0',
      sourceBranch: 'main',
      targetEnvironment: 'Staging',
    });
  });
});

const detail = {
  id: 'order-1',
  projectId: 'project-1',
  releaseVersion: '1.0.0',
  preflight: { repository: { branch: 'main' } },
} as ReleaseOrderDetail;

const summary = {
  baselines: {
    staging: { id: 'staging', key: 'staging', name: 'Staging', ready: true },
    production: { id: 'production', key: 'production', name: 'Production', ready: true },
  },
} as ProjectDeliverySummary;
