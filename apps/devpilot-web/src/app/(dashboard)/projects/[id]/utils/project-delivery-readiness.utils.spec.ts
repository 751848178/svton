import type { Project } from '../types';
import { getProjectDeliveryReadiness } from './project-delivery-readiness.utils';

describe('getProjectDeliveryReadiness repository truth boundary', () => {
  it('does not count a manually entered Git URL as verified source readiness', () => {
    const result = getProjectDeliveryReadiness(
      project({ gitRepo: 'https://example.com/manual.git' }),
      [],
      { connected: false, analyzed: false, applied: false, complete: false },
    );
    expect(result.stages.find((stage) => stage.key === 'source')).toMatchObject({
      status: 'current',
      detailKey: 'deliveryStageSourceManual',
    });
    expect(result.nextAction).toBe('open_repository');
  });

  it('keeps a verified connection incomplete until suggestions are applied', () => {
    const result = getProjectDeliveryReadiness(
      project({}),
      [],
      { connected: true, analyzed: false, applied: false, complete: false },
    );
    expect(result.stages.find((stage) => stage.key === 'source')).toMatchObject({
      status: 'attention',
      detailKey: 'deliveryStageSourceConnected',
    });
    expect(result.nextAction).toBe('open_repository');
  });

  it('counts source complete only from the backend applied readiness state', () => {
    const result = getProjectDeliveryReadiness(
      project({}),
      [],
      { connected: true, analyzed: true, applied: true, complete: true },
    );
    expect(result.stages.find((stage) => stage.key === 'source')).toMatchObject({
      status: 'complete',
      detailKey: 'deliveryStageSourceComplete',
      evidence: 'verified+analyzed+applied',
    });
    expect(result.nextAction).toBe('open_environments');
  });

  it('keeps repository optional for resource-only projects', () => {
    const result = getProjectDeliveryReadiness(
      project({ config: { managementScope: 'resources' } }),
      [],
      { connected: false, analyzed: false, applied: false, complete: false },
    );
    expect(result.stages.find((stage) => stage.key === 'source')).toMatchObject({
      status: 'complete',
      detailKey: 'deliveryStageSourceSkipped',
    });
    expect(result.nextAction).not.toBe('open_repository');
  });
});

function project(overrides: Partial<Project>): Project {
  return {
    id: 'project-1',
    name: 'Picshare',
    description: null,
    gitRepo: null,
    downloadUrl: null,
    config: { managementScope: 'full' },
    createdAt: '2026-07-29T00:00:00.000Z',
    updatedAt: '2026-07-29T00:00:00.000Z',
    environments: [],
    applications: [],
    resourceInstances: [],
    ...overrides,
  };
}
