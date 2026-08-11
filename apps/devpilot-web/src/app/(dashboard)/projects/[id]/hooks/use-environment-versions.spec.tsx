// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVersionActionResult } from '../types/environment-version.types';
import { useEnvironmentVersions } from './use-environment-versions';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  mutateCache: vi.fn(),
}));

vi.mock('swr', () => ({
  useSWRConfig: () => ({ mutate: mocks.mutateCache }),
}));
vi.mock('@/lib/api-client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('./use-project-delivery-summary', () => ({
  isProjectDeliverySummaryCacheKey: (key: unknown, projectId: string) =>
    Array.isArray(key) &&
    key[2] === projectId &&
    key[3] === `GET:/projects/${projectId}/delivery/summary`,
}));

describe('useEnvironmentVersions refresh contract', () => {
  let root: Root;
  let container: HTMLDivElement;
  let latest: ReturnType<typeof useEnvironmentVersions>;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    root = createRoot(container);
    mocks.apiRequest.mockReset().mockImplementation((endpoint: string) => {
      if (endpoint.startsWith('GET:')) {
        return Promise.resolve({
          environments: [],
          candidates: { staging: [], production: [] },
        });
      }
      return Promise.resolve({ environmentVersion: { id: 'version-new' } });
    });
    mocks.mutateCache.mockReset().mockResolvedValue(undefined);
  });

  afterEach(async () => act(async () => root.unmount()));

  it('revalidates the environment and scoped project summary after a successful action', async () => {
    function Harness() {
      latest = useEnvironmentVersions('project-1');
      return null;
    }
    await act(async () => root.render(<Harness />));
    await act(async () => undefined);

    let result: EnvironmentVersionActionResult | null = null;
    await act(async () => {
      result = await latest.execute('environment-1', {
        kind: 'upgrade',
        manifestId: 'manifest-2',
      });
    });

    expect(result).toEqual({ environmentVersion: { id: 'version-new' } });
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      'POST:/projects/project-1/delivery/environment-versions/environment-1/actions',
      expect.objectContaining({
        kind: 'upgrade',
        manifestId: 'manifest-2',
        idempotencyKey: expect.any(String),
      }),
    );
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      'GET:/projects/project-1/delivery/environment-versions',
    );
    expect(mocks.mutateCache).toHaveBeenCalledTimes(1);
    const [matches, value, options] = mocks.mutateCache.mock.calls[0];
    expect(
      matches(['actor-1', 'team-1', 'project-1', 'GET:/projects/project-1/delivery/summary']),
    ).toBe(true);
    expect(
      matches(['actor-1', 'team-1', 'project-2', 'GET:/projects/project-2/delivery/summary']),
    ).toBe(false);
    expect(value).toBeUndefined();
    expect(options).toEqual({ revalidate: true });
  });

  it('resumes the exact frozen production candidate and refreshes the server-owned checkpoint', async () => {
    function Harness() {
      latest = useEnvironmentVersions('project-1');
      return null;
    }
    await act(async () => root.render(<Harness />));
    await act(async () => undefined);
    const input = {
      releaseRunId: 'release-1',
      deploymentRunId: 'deployment-1',
      candidateHash: 'a'.repeat(64),
    };

    await act(async () => {
      await latest.resumePromotion('environment-1', input);
    });

    expect(mocks.apiRequest).toHaveBeenCalledWith(
      'POST:/projects/project-1/delivery/environment-versions/environment-1/production-promotion/resume',
      { ...input, idempotencyKey: expect.any(String) },
    );
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      'GET:/projects/project-1/delivery/environment-versions',
    );
    expect(mocks.mutateCache).toHaveBeenCalledTimes(1);
  });

  it('shows a blocked domain result returned with HTTP 200', async () => {
    mocks.apiRequest.mockImplementation((endpoint: string) => endpoint.startsWith('GET:')
      ? Promise.resolve({ environments: [], candidates: { staging: [], production: [] } })
      : Promise.resolve({ status: 'blocked', errorCode: 'READBACK_UNKNOWN',
          errorMessage: 'Provider readback is inconclusive' }));
    function Harness() { latest = useEnvironmentVersions('project-1'); return null; }
    await act(async () => root.render(<Harness />));
    await act(async () => undefined);
    await act(async () => {
      await latest.reconcilePromotion('environment-1', 'promotion-1');
    });
    expect(latest.error).toBe('Provider readback is inconclusive');
  });
});
