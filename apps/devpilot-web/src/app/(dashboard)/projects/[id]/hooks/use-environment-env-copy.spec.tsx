// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEnvironmentEnvCopy } from './use-environment-env-copy';
import { useEnvironmentEnvVars } from './use-environment-env-vars';

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ apiRequest: mocks.apiRequest }));

function renderHarness(render: () => unknown): { root: Root; get: () => unknown } {
  let latest: unknown;
  function Harness() {
    latest = render();
    return null;
  }
  const root = createRoot(document.createElement('div'));
  void act(() => {
    root.render(<Harness />);
  });
  return { root, get: () => latest };
}

describe('useEnvironmentEnvCopy (F447 AC-SET-036)', () => {
  let root: Root;
  let harness: { root: Root; get: () => unknown };

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    mocks.apiRequest.mockReset();
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
  });

  it('posts targets with per-env CAS and reference-only payload, never values', async () => {
    mocks.apiRequest.mockResolvedValue({
      sourceEnvironmentId: 'env-source',
      results: [
        { environmentId: 'env-preview', key: 'preview', ok: true, revision: { id: 'r1', revision: 1, snapshotHash: 'h' } },
      ],
    });
    harness = renderHarness(() => useEnvironmentEnvCopy('env-source'));
    root = harness.root;
    const latest = harness.get() as ReturnType<typeof useEnvironmentEnvCopy>;

    let result: unknown;
    await act(async () => {
      result = await latest.copy({
        targets: [
          { environmentId: 'env-preview', expectedCurrentRevisionId: 'rev-0' },
          { environmentId: 'env-prod' },
        ],
        plainVariables: { NODE_ENV: 'production' },
        secretReferenceIds: ['secret-1', 'secret-2'],
        changeSummary: '从 staging 复用变量与密钥引用',
      });
    });

    const [route, payload] = mocks.apiRequest.mock.calls[0] as [string, Record<string, unknown>];
    expect(route).toBe('POST:/project-environments/env-source/config-revisions/copy');
    expect(payload).toEqual({
      targets: [
        { environmentId: 'env-preview', expectedCurrentRevisionId: 'rev-0' },
        { environmentId: 'env-prod', expectedCurrentRevisionId: undefined },
      ],
      plainVariables: { NODE_ENV: 'production' },
      secretReferenceIds: ['secret-1', 'secret-2'],
      changeSummary: '从 staging 复用变量与密钥引用',
    });
    // The payload must never carry secret values (refs only).
    expect(JSON.stringify(payload)).not.toMatch(/AKIA|s3cr3t|plaintext/i);
    expect(result).toMatchObject({ results: [{ environmentId: 'env-preview', ok: true }] });
  });
});

describe('useEnvironmentEnvVars.save payload contract (F447 AC-SET-033/040)', () => {
  let root: Root;
  let harness: { root: Root; get: () => unknown };

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    mocks.apiRequest.mockReset();
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
  });

  it('saves only plain variables with CAS and never touches secret values', async () => {
    mocks.apiRequest.mockResolvedValue({
      environment: { id: 'env-1', currentConfigRevisionId: 'rev-9' },
      revision: { id: 'rev-9', revision: 9 },
    });
    const onSaved = vi.fn();
    harness = renderHarness(() =>
      useEnvironmentEnvVars(
        {
          id: 'env-1',
          currentConfigRevisionId: 'rev-8',
          config: { envVars: { NODE_ENV: 'production' } },
        } as never,
        onSaved,
      ),
    );
    root = harness.root;
    const latest = harness.get() as ReturnType<typeof useEnvironmentEnvVars>;

    await act(async () => {
      await latest.save();
    });

    const [route, payload] = mocks.apiRequest.mock.calls[0] as [string, Record<string, unknown>];
    expect(route).toBe('POST:/project-environments/env-1/config-revisions');
    expect(payload).toEqual({
      plainVariables: { NODE_ENV: 'production' },
      expectedCurrentRevisionId: 'rev-8',
      changeSummary: '更新普通环境变量',
    });
    expect(onSaved).toHaveBeenCalled();
  });
});
