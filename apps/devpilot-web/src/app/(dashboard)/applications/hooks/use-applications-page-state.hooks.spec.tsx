// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { useApplicationsPageState } from './use-applications-page-state.hooks';
import type { ApplicationItem } from '../types';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe('useApplicationsPageState deployment deep link', () => {
  let root: Root;
  let container: HTMLDivElement;
  let current: ReturnType<typeof useApplicationsPageState>;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    root = createRoot(container);
  });

  it('opens the exact scoped service deployment editor after data loads', async () => {
    await render([]);
    expect(current.editingDeployment).toBeNull();
    await render([application()]);
    expect(current.editingDeployment).toMatchObject({
      application: { id: 'app-1', projectId: 'project-1' },
      service: { id: 'service-1', environment: { id: 'production-id' } },
    });
    act(() => root.unmount());
  });

  it('rejects a service whose project or environment does not match the link', async () => {
    const wrong = application();
    wrong.services[0].environment.id = 'staging-id';
    await render([wrong]);
    expect(current.editingDeployment).toBeNull();
    act(() => root.unmount());
  });

  async function render(applications: ApplicationItem[]) {
    await act(async () => root.render(<Probe applications={applications} />));
  }

  function Probe({ applications }: { applications: ApplicationItem[] }) {
    current = useApplicationsPageState({
      shouldCreate: false,
      deploymentDeepLink: { projectId: 'project-1', environmentId: 'production-id',
        serviceId: 'service-1' },
      applications, environments: [], sites: [], resources: [],
    });
    return null;
  }
});

function application() {
  return {
    id: 'app-1', projectId: 'project-1', name: 'app', status: 'active',
    services: [{ id: 'service-1', name: 'api', kind: 'service', status: 'active',
      environment: { id: 'production-id', key: 'production', name: 'Production',
        status: 'active' } }],
  } as ApplicationItem;
}
