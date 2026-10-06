import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { DeploymentRun } from '../types/operations';
import { ProjectDeploymentRunRow } from './project-deployment-run-row';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/components/ui', () => ({
  StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
}));

describe('ProjectDeploymentRunRow', () => {
  it('keeps both exact-run triggers as real buttons for drawer focus restoration', () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <ProjectDeploymentRunRow
            run={run()}
            versionLabel="1.0.0"
            onSelect={vi.fn()}
          />
        </tbody>
      </table>,
    );
    expect((html.match(/<button/g) ?? []).length).toBe(2);
    expect(html).toContain('deploymentViewEvidence');
    expect(html).toContain('run-1');
    expect(html).toContain('data-deployment-run-trigger="run-1:run"');
    expect(html).toContain('data-deployment-run-trigger="run-1:evidence"');
  });
});

function run() {
  return {
    id: 'run-1',
    status: 'succeeded',
    environment: 'production',
    startedAt: '2026-08-28T00:00:00Z',
    finishedAt: '2026-08-28T00:01:00Z',
    actor: { name: 'Operator' },
  } as DeploymentRun;
}
