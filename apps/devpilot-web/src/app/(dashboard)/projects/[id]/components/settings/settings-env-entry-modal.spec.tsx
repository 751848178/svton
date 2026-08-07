import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SettingsEnvEntryModal } from './settings-env-entry-modal';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock('@svton/ui', () => ({
  Modal: ({ open, title, children, footer }: {
    open: boolean;
    title: React.ReactNode;
    children: React.ReactNode;
    footer: React.ReactNode;
  }) =>
    open ? (
      <div>
        <div>{title}</div>
        {children}
        <div>{footer}</div>
      </div>
    ) : null,
}));

describe('SettingsEnvEntryModal (F448 AC-SET-043)', () => {
  it('renders the Demo-aligned fields: Host/Path/目标组件与端口/TLS with both options', () => {
    const html = renderToStaticMarkup(
      <SettingsEnvEntryModal
        open
        environmentName="Production"
        onClose={() => undefined}
        onConfirm={() => undefined}
      />,
    );
    expect(html).toContain('envRoutesAddEntryTitle');
    expect(html).toContain('Production');
    expect(html).toContain('envRoutesModalCallout');
    expect(html).toContain('envRoutesHostLabel');
    expect(html).toContain('envRoutesHostPlaceholder');
    expect(html).toContain('envRoutesPathLabel');
    expect(html).toContain('envRoutesTargetLabel');
    expect(html).toContain('web : 3000');
    expect(html).toContain('api : 8080');
    expect(html).toContain('envRoutesTlsLabel');
    expect(html).toContain('envRoutesTlsManaged');
    expect(html).toContain('envRoutesTlsExisting');
    expect(html).toContain('envRoutesAddEntryConfirm');
  });

  it('renders nothing when closed', () => {
    const html = renderToStaticMarkup(
      <SettingsEnvEntryModal
        open={false}
        environmentName="Production"
        onClose={() => undefined}
        onConfirm={() => undefined}
      />,
    );
    expect(html).toBe('');
  });
});
