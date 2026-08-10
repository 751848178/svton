// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReleasePolicy } from './use-release-policy';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}));
vi.mock('@/lib/api-client', () => ({ apiRequest: mocks.apiRequest }));

const response = {
  current: {
    id: 'rev-3',
    revision: 3,
    strategy: 'standard',
    requireProductionApproval: true,
    snapshotHash: 'a'.repeat(64),
    createdAt: '2026-08-07T00:00:00.000Z',
    createdBy: { id: 'u1', name: 'Reviewer', email: 'reviewer@example.com' },
  },
  capabilities: [],
};

describe('useReleasePolicy save CAS contract', () => {
  let root: Root;
  let latest: ReturnType<typeof useReleasePolicy>;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    mocks.apiRequest.mockReset();
    root = createRoot(document.createElement('div'));
  });

  afterEach(async () => act(async () => root.unmount()));

  it('loads the current policy revision on mount', async () => {
    mocks.apiRequest.mockResolvedValue(response);
    await render();
    expect(mocks.apiRequest).toHaveBeenCalledWith('GET:/projects/project-1/release-policy');
    expect(latest.policy?.current.revision).toBe(3);
  });

  it('saves a standard revision with the expected current revision CAS and refreshes the policy', async () => {
    mocks.apiRequest.mockResolvedValue(response);
    await render();
    mocks.apiRequest.mockResolvedValue({ ...response, current: { ...response.current, revision: 4, id: 'rev-4' } });
    await act(async () => {
      await latest.saveStandard();
    });
    expect(mocks.apiRequest).toHaveBeenCalledWith('POST:/projects/project-1/release-policy', {
      strategy: 'standard',
      requireProductionApproval: true,
      expectedCurrentRevisionId: 'rev-3',
    });
    expect(latest.policy?.current.revision).toBe(4);
    expect(latest.error).toBe('');
  });

  it('omits the CAS when no revision exists yet (synthetic default)', async () => {
    mocks.apiRequest.mockResolvedValue({
      current: {
        id: null,
        revision: 0,
        strategy: 'standard',
        requireProductionApproval: true,
        snapshotHash: 'default-standard-policy-v1',
        synthetic: true,
      },
      capabilities: [],
    });
    await render();
    mocks.apiRequest.mockResolvedValue(response);
    await act(async () => {
      await latest.saveStandard();
    });
    expect(mocks.apiRequest).toHaveBeenCalledWith('POST:/projects/project-1/release-policy', {
      strategy: 'standard',
      requireProductionApproval: true,
    });
  });

  it('surfaces the stale-revision conflict message without clearing the policy', async () => {
    mocks.apiRequest.mockResolvedValue(response);
    await render();
    mocks.apiRequest.mockRejectedValue(new Error('发布策略已更新，请刷新后重试'));
    await act(async () => {
      await latest.saveStandard();
    });
    expect(latest.error).toBe('发布策略已更新，请刷新后重试');
    expect(latest.policy?.current.revision).toBe(3);
    expect(latest.saving).toBe(false);
  });

  async function render() {
    await act(async () => root.render(<Probe />));
  }

  function Probe() {
    latest = useReleasePolicy('project-1');
    return null;
  }
});
