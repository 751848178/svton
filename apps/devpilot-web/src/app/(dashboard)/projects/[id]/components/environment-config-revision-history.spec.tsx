import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EnvironmentConfigRevisionHistory } from './environment-config-revision-history';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const t = ((key: string) => key) as never;

function revision(id: string, n: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    revision: n,
    snapshotHash: 'abcd'.repeat(16),
    plainVariables: {},
    secretReferences: [],
    resourceReferences: [],
    routeSnapshot: {},
    policyReferences: [],
    source: 'project_management',
    createdAt: '2026-07-01T00:00:00Z',
    current: false,
    ...extra,
  } as never;
}

describe('EnvironmentConfigRevisionHistory (F447 AC-SET-039)', () => {
  it('renders R/source/time/change-summary/createdBy per row with the current badge', () => {
    const html = renderToStaticMarkup(
      <EnvironmentConfigRevisionHistory
        revisions={[
          revision('rev-4', 4, {
            current: true,
            changeSummary: '导入 DATABASE_URL',
            createdBy: { id: 'user-1', name: '张三', email: 'zhang@example.com' },
          }),
          revision('rev-3', 3),
        ]}
        t={t}
      />,
    );

    expect(html).toContain('configRevisionHistoryTitle');
    expect(html).toContain('R4');
    expect(html).toContain('R3');
    expect(html).toContain('configRevisionCurrentBadge');
    expect(html).toContain('project_management');
    expect(html).toContain('导入 DATABASE_URL');
    expect(html).toContain('configRevisionNoSummary');
    expect(html).toContain('张三');
  });

  it('renders nothing when there is no history yet', () => {
    const html = renderToStaticMarkup(
      <EnvironmentConfigRevisionHistory revisions={[]} t={t} />,
    );
    expect(html).toBe('');
  });
});
