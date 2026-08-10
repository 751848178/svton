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
        targetOptions={[
          { serviceId: 'service-web', component: 'frontend', port: 4173 },
          { serviceId: 'service-api', component: 'backend', port: 4310 },
        ]}
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
    expect(html).toContain('frontend : 4173');
    expect(html).toContain('backend : 4310');
    expect(html).not.toContain('web : 3000');
    expect(html).not.toContain('api : 8080');
    expect(html).toContain('envRoleCustom');
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
        targetOptions={[]}
        onClose={() => undefined}
        onConfirm={() => undefined}
      />,
    );
    expect(html).toBe('');
  });
});
