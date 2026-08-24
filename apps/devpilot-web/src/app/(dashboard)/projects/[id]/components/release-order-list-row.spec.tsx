import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ReleaseOrderListItem } from '../types/release-order-list.types';
import { ReleaseOrderListRow } from './release-order-list-row';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/components/ui', () => ({
  StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

describe('ReleaseOrderListRow compact table contract', () => {
  it('makes version and ID actionable and keeps operations in their own cell', () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <ReleaseOrderListRow
            item={item()}
            onOpen={vi.fn()}
          />
        </tbody>
      </table>,
    );
    expect(html).toContain('1.4.0');
    expect(html).toContain('图库重构');
    expect(html).toContain('order-1');
    expect(html).toContain('master @ a1b2c3d4');
    expect(html).toContain('releaseOrderActionBuild');
    expect(html).toContain('releaseOrderActionDeployment');
    expect(html).toContain('releaseOrderMoreActions');
    expect(html).not.toContain('<article');
  });

  it('labels historical timestamp versions as legacy records', () => {
    const legacy = item();
    legacy.releaseVersion = 'v202608200822';
    legacy.releaseName = 'v202608200822';
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <ReleaseOrderListRow
            item={legacy}
            onOpen={vi.fn()}
          />
        </tbody>
      </table>,
    );
    expect(html).toContain('releaseLegacyNameFallback');
    expect(html).toContain('releaseLegacyVersionValue');
  });
});

function item(): ReleaseOrderListItem {
  return {
    id: 'order-1',
    projectId: 'project-1',
    releaseVersion: '1.4.0',
    releaseName: '图库重构',
    note: null,
    persistedStatus: 'active',
    lifecycle: {
      status: 'staging',
      phase: 'staging',
      sourceType: 'deployment_run',
      sourceId: 'deploy-1',
      sourceStatus: 'running',
      occurredAt: '2026-08-21T01:00:00Z',
    },
    createdAt: '2026-08-21T00:00:00Z',
    source: {
      branch: 'master',
      commitSha: 'a1b2c3d4e5f6',
      buildRunId: 'build-1',
      buildRevision: 1,
      buildStatus: 'succeeded',
    },
    build: {
      count: 1,
      recentSuccessfulManifest: {
        id: 'manifest-1',
        digest: 'sha256:abc',
        buildRunId: 'build-1',
        buildRevision: 1,
        createdAt: '2026-08-21T00:30:00Z',
      },
    },
    deployment: {
      count: 1,
      latest: {
        id: 'deploy-1',
        environmentId: 'staging-1',
        environmentRole: 'staging',
        environmentName: 'Staging',
        status: 'running',
        artifactManifestId: 'manifest-1',
        buildRunId: 'build-1',
        occurredAt: '2026-08-21T01:00:00Z',
      },
    },
    lastExecution: {
      step: 'staging',
      sourceType: 'deployment_run',
      sourceId: 'deploy-1',
      status: 'running',
      occurredAt: '2026-08-21T01:00:00Z',
    },
    lastExecutedAt: '2026-08-21T01:00:00Z',
  };
}
