import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectDeliverySummary } from '../../types/project-delivery-summary.types';
import type { ReleaseOrderDetail } from '../../types/release-order.types';
import { ReleaseInputSummary } from './release-input-summary';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe('ReleaseInputSummary', () => {
  it('renders only the minimum human-readable release inputs', () => {
    const html = renderToStaticMarkup(
      <ReleaseInputSummary
        detail={detail}
        projectSummary={summary}
      />,
    );
    expect(html.match(/releaseInputTitle/g)).toHaveLength(1);
    expect(html).toContain('1.0.0');
    expect(html).toContain('main');
    expect(html).toContain('Staging');
    expect(html).not.toContain('sha256');
    expect(html).not.toContain('Manifest');
    expect(html).not.toContain('BuildRun');
  });
});

const detail = {
  id: 'order-1',
  releaseVersion: '1.0.0',
  preflight: { repository: { branch: 'main' } },
} as ReleaseOrderDetail;

const summary = {
  baselines: {
    staging: { id: 'staging', key: 'staging', name: 'Staging', ready: true },
    production: null,
  },
} as ProjectDeliverySummary;
