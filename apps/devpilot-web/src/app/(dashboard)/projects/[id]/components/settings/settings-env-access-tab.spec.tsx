import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EnvAccessTab } from './settings-env-access-tab';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock('./settings-subtab-shell', () => ({
  SubtabShell: (props: {
    actions: React.ReactNode;
    children: React.ReactNode;
    moduleHref: string;
    moduleLabel: string;
  }) => (
    <section>
      <a href={props.moduleHref}>{props.moduleLabel}</a>
      <header>{props.actions}</header>
      {props.children}
    </section>
  ),
}));

describe('EnvAccessTab', () => {
  it('explains the default permission and release-approval boundary', () => {
    const html = renderToStaticMarkup(
      <EnvAccessTab
        environment={{ id: 'env-1', key: 'prod-env' } as never}
        policies={[]}
        policyIds={[]}
        onPolicyIdsChange={vi.fn()}
      />,
    );
    expect(html).toContain('envAccessScopeDescription');
    expect(html).toContain('envAccessNoPolicySelected');
    expect(html).toContain('href="/access-policies"');
    expect(html).toContain('href="/operation-approvals"');
    expect(html.match(/envAccessConfigurePolicies/g)).toHaveLength(1);
    expect(html).not.toContain('envProtectionNone');
    expect(html.match(/data-settings-data-surface="true"/g)).toHaveLength(1);
    expect(html).not.toContain('rounded-md border px-4');
  });

  it('shows policy effect and concrete server actions', () => {
    const html = renderToStaticMarkup(
      <EnvAccessTab
        environment={{ id: 'env-1', key: 'prod-env' } as never}
        policies={[
          {
            id: 'policy-1',
            name: 'Production operators',
            effect: 'allow',
            actions: ['project.release_order.deploy_prod'],
            categories: ['release-category'],
          },
        ]}
        policyIds={['policy-1']}
        onPolicyIdsChange={vi.fn()}
        revision={{ policyReferences: [{ id: 'policy-1' }] } as never}
      />,
    );
    expect(html).toContain('Production operators');
    expect(html).toContain('envAccessEffectAllow');
    expect(html).toContain('project.release_order.deploy_prod');
    expect(html).toContain('release-category');
    expect(html).toContain('prod-env');
    expect(html).toContain('envAccessStatusEffective');
    const cells = [
      'Production operators',
      'envAccessEffectAllow',
      'project.release_order.deploy_prod',
      'release-category',
      'prod-env',
      'envAccessStatusEffective',
    ];
    expect(cells.map((cell) => html.indexOf(cell))).toEqual(
      [...cells.map((cell) => html.indexOf(cell))].sort((a, b) => a - b),
    );
  });
});
