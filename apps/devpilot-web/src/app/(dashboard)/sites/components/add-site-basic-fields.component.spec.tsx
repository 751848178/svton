import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AddSiteBasicFields } from './add-site-basic-fields.component';
import type { AddSiteFormData } from './add-site-form.types';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

describe('AddSiteBasicFields scoped project context', () => {
  it('locks project and environment without unscoped options', () => {
    const html = renderToStaticMarkup(
      <AddSiteBasicFields
        formData={form()}
        servers={[]}
        projects={[{ id: 'project-1', name: 'Picshare' }]}
        projectEnvironments={[
          {
            id: 'production',
            projectId: 'project-1',
            key: 'production',
            name: 'Production',
            status: 'active',
          },
        ]}
        lockedContext={{ projectName: 'Picshare', environmentName: 'Production' }}
        onChange={vi.fn()}
      />,
    );
    expect(html).toContain('Picshare');
    expect(html).toContain('Production');
    expect(html).not.toContain('noProject');
    expect(html).not.toContain('noEnvironment');
  });
});

function form(): AddSiteFormData {
  return {
    name: '',
    primaryDomain: '',
    aliases: '',
    runtimeType: 'reverse_proxy',
    upstreamUrl: '',
    rootPath: '',
    containerName: '',
    containerPort: '3000',
    websocket: false,
    tlsEnabled: false,
    tlsType: 'letsencrypt',
    tlsEmail: '',
    allowedCidrs: '',
    basicAuth: false,
    serverId: '',
    projectId: 'project-1',
    environmentId: 'production',
    proxyConfigId: '',
  };
}
