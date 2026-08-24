import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EnvAccessTab } from './settings-env-access-tab';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock('./settings-subtab-shell', () => ({
  SubtabShell: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}));

describe('EnvAccessTab', () => {
  it('explains the default permission and release-approval boundary', () => {
    const html = renderToStaticMarkup(
      <EnvAccessTab
        environment={{ id: 'env-1', key: 'production' } as never}
        policies={[]}
        policyIds={[]}
        onPolicyIdsChange={vi.fn()}
      />,
    );
    expect(html).toContain('envAccessScopeDescription');
    expect(html).toContain('envAccessNoPoliciesAvailable');
    expect(html).not.toContain('envProtectionNone');
  });

  it('shows policy effect and concrete server actions', () => {
    const html = renderToStaticMarkup(
      <EnvAccessTab
        environment={{ id: 'env-1', key: 'production' } as never}
        policies={[
          {
            id: 'policy-1',
            name: 'Production operators',
            effect: 'allow',
            actions: ['project.release_order.deploy_production'],
          },
        ]}
        policyIds={['policy-1']}
        onPolicyIdsChange={vi.fn()}
      />,
    );
    expect(html).toContain('Production operators');
    expect(html).toContain('envAccessEffectAllow');
    expect(html).toContain('project.release_order.deploy_production');
  });
});
