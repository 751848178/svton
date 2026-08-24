// @vitest-environment jsdom

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReleaseOrderListRow } from './release-order-list-row';
import type { ReleaseOrderListItem } from '../types/release-order-list.types';

vi.mock('next-intl', () => ({
  useLocale: () => 'zh-CN',
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

describe('F453 long-value access (AC-UI-022)', () => {
  it('keeps the full release identifier available in the compact table', () => {
    const id = 'release-order-very-long-id-abcdefghijklmnop';
    const html = renderToStaticMarkup(
      <ReleaseOrderListRow
        item={listItem(id)}
        onOpen={() => {}}
      />,
    );
    expect(html).toContain('class="mt-0.5 block max-w-44 truncate');
    expect(html).toContain(`title="${id}"`);
  });
});

function listItem(id: string): ReleaseOrderListItem {
  return {
    id,
    projectId: 'project-1',
    releaseVersion: '2.4.1',
    note: '',
    persistedStatus: 'active',
    lifecycle: {
      status: 'awaiting_approval',
      phase: 'production',
      sourceType: 'release_run',
      sourceId: 'release-run-1',
      sourceStatus: 'awaiting_approval',
      occurredAt: '2026-08-04T08:00:00.000Z',
    },
    createdAt: '2026-08-04T01:00:00.000Z',
    source: {
      branch: 'main',
      commitSha: 'c'.repeat(40),
      buildRunId: 'build-3',
      buildRevision: 3,
      buildStatus: 'succeeded',
    },
    build: {
      count: 3,
      recentSuccessfulManifest: {
        id: 'manifest-2',
        digest: `sha256:${'b'.repeat(64)}`,
        buildRunId: 'build-2',
        buildRevision: 2,
        createdAt: '2026-08-04T05:00:00.000Z',
      },
    },
    deployment: { count: 0, latest: null },
    lastExecution: {
      step: 'production',
      sourceType: 'release_run',
      sourceId: 'release-run-1',
      status: 'awaiting_approval',
      occurredAt: '2026-08-04T08:00:00.000Z',
    },
    lastExecutedAt: '2026-08-04T08:00:00.000Z',
  } as unknown as ReleaseOrderListItem;
}
