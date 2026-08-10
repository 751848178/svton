// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import type { ReleaseOrderDetail } from '../types/release-order.types';
import { ReleaseOrderPreflightStep } from './release-order-preflight-step';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('./release-gate-catalog-panel', () => ({
  ReleaseGateCatalogPanel: ({
    projectId,
    releaseOrderId,
  }: {
    projectId: string;
    releaseOrderId: string;
  }) => (
    <div
      data-project={projectId}
      data-release-order={releaseOrderId}
    >
      real-gate-owner
    </div>
  ),
}));

describe('ReleaseOrderPreflightStep', () => {
  it('delegates the first screen to the real gate catalog without legacy baseline cards', async () => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => root.render(<ReleaseOrderPreflightStep detail={detail()} />));

    expect(container.textContent).toContain('releaseStepPreflightTitle');
    expect(container.textContent).toContain('real-gate-owner');
    expect(container.textContent).not.toContain('releasePreflightRepository');
    expect(container.textContent).not.toContain('releasePreflightStaging');
    expect(container.textContent).not.toContain('releasePreflightProduction');
    expect(
      container.querySelector('[data-project="project-1"]')?.getAttribute('data-release-order'),
    ).toBe('order-1');

    await act(async () => root.unmount());
  });
});

function detail(): ReleaseOrderDetail {
  return {
    id: 'order-1',
    projectId: 'project-1',
    preflight: {
      repository: { ready: false, branch: null },
      staging: { ready: false },
      production: { ready: false },
    },
  } as ReleaseOrderDetail;
}
