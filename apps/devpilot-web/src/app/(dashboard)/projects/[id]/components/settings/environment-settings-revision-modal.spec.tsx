import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { CreateEnvironmentConfigRevisionResult } from '../../types/environment-config-revision.types';
import { EnvironmentSettingsRevisionModal } from './environment-settings-revision-modal';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/lib/format-date', () => ({ formatDateTimeMinute: (value: string) => value }));
vi.mock('@/components/ui', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  Input: ({
    invalid: _invalid,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) => <input {...props} />,
  Modal: ({
    open,
    title,
    description,
    children,
    footer,
  }: {
    open: boolean;
    title: React.ReactNode;
    description: React.ReactNode;
    children: React.ReactNode;
    footer: React.ReactNode;
  }) =>
    open ? (
      <div role="dialog">
        <h1>{title}</h1>
        <p>{description}</p>
        {children}
        {footer}
      </div>
    ) : null,
}));

describe('EnvironmentSettingsRevisionModal', () => {
  it('programmatically labels the change reason input inside the review modal', () => {
    const html = renderToStaticMarkup(
      <EnvironmentSettingsRevisionModal
        open
        environmentName="Staging"
        summary=""
        changes={[]}
        blockers={[]}
        saving={false}
        error=""
        result={null}
        onSummaryChange={vi.fn()}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(html).toMatch(/<label[^>]*>[\s\S]*configChangeSummary[\s\S]*<input/);
  });

  it('keeps the reason and complete diff visible with a stable inline write error', () => {
    const html = renderToStaticMarkup(
      <EnvironmentSettingsRevisionModal
        open
        environmentName="Staging"
        summary="route migration"
        changes={[{ area: 'variables', before: 'NODE_ENV=dev', after: 'NODE_ENV=prod' }]}
        blockers={[]}
        saving={false}
        error="环境配置已更新，请刷新后重试"
        result={null}
        onSummaryChange={vi.fn()}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(html).toContain('环境配置已更新，请刷新后重试');
    expect(html).toContain('value="route migration"');
    expect(html).toContain('NODE_ENV=dev');
    expect(html).toContain('NODE_ENV=prod');
    expect(html).toContain('configRevisionImpact_variables');
  });

  it('shows the exact revision and audit response instead of closing after success', () => {
    const html = renderToStaticMarkup(
      <EnvironmentSettingsRevisionModal
        open
        environmentName="Staging"
        summary="route migration"
        changes={[]}
        blockers={[]}
        saving={false}
        error=""
        result={resultFixture()}
        onSummaryChange={vi.fn()}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(html).toContain('configRevisionResultTitle');
    expect(html).toContain('R4');
    expect(html).toContain('hash-4');
    expect(html).toContain('audit-4');
    expect(html).toContain('completed');
    expect(html).toContain('route migration');
  });
});

function resultFixture(): CreateEnvironmentConfigRevisionResult {
  return {
    environment: {
      id: 'env-1',
      key: 'staging',
      name: 'Staging',
      status: 'active',
      config: {},
      identityLockedAt: null,
      currentConfigRevisionId: 'rev-4',
    },
    revision: {
      id: 'rev-4',
      revision: 4,
      snapshotHash: 'hash-4',
      plainVariables: {},
      secretReferences: [],
      resourceReferences: [],
      routeSnapshot: {},
      policyReferences: [],
      source: 'project_management',
      createdAt: '2026-08-28T00:00:00Z',
      current: true,
    },
    auditEvent: {
      id: 'audit-4',
      action: 'project_environment.config_revision.create',
      targetType: 'environment_config_revision',
      targetId: 'rev-4',
      risk: 'medium',
      status: 'completed',
      summary: 'route migration',
      occurredAt: '2026-08-28T00:00:00Z',
    },
  };
}
