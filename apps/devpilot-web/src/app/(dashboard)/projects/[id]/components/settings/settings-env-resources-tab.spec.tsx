import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EnvResourcesTab } from './settings-env-resources-tab';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('./settings-subtab-shell', () => ({
  SubtabShell: (props: { actions: React.ReactNode; children: React.ReactNode }) => (
    <section>
      <header>{props.actions}</header>
      <main>{props.children}</main>
    </section>
  ),
}));
vi.mock('./settings-resource-binding-modal', () => ({
  SettingsResourceBindingModal: () => <button>envResourceEditBindings</button>,
}));
vi.mock('../environment-resource-binding-table', () => ({
  EnvironmentResourceBindingTable: () => <div>resource-binding-table</div>,
}));

describe('EnvResourcesTab action hierarchy', () => {
  it('keeps one edit action in the subtab header and the body read-only', () => {
    const html = renderToStaticMarkup(
      <EnvResourcesTab
        environment={{ id: 'env-1', name: 'Production' } as never}
        detail={{ project: { id: 'project-1' } } as never}
        resources={[]}
        onResourcesChange={vi.fn()}
        revision={null}
      />,
    );
    expect(html.match(/envResourceEditBindings/g)).toHaveLength(1);
    expect(html.indexOf('envResourceEditBindings')).toBeLessThan(
      html.indexOf('resource-binding-table'),
    );
    expect(html).not.toContain('ResourceCountChips');
  });
});
