import { describe, expect, it, vi } from 'vitest';
import type { Site } from '@/app/(dashboard)/sites/types';
import { persistProjectDomainWorkflow } from './project-domain-workflow-submit';

const form = {
  targetKey: 'app-1:service-1:8080', path: '/web', name: 'Web',
  primaryDomain: 'Web.Example.com', aliases: 'www.example.com',
  tlsMode: 'managed_cert' as const, changeReason: '新增生产入口',
};
const target = {
  key: form.targetKey, applicationId: 'app-1', serviceId: 'service-1',
  component: 'web', port: 8080, serverId: 'server-1', serverLabel: 'Server', siteId: null,
};
const site = {
  id: 'site-1', name: 'Web', primaryDomain: 'web.example.com', aliases: ['www.example.com'],
  runtimeType: 'reverse_proxy', runtimeConfig: null, tls: null, accessPolicy: null,
  status: 'pending', lastSyncAt: null, syncError: null, createdAt: '2026-08-27T00:00:00Z',
} as Site;

describe('project domain workflow submission', () => {
  it('persists Site, binding, and the route revision in their real API order', async () => {
    const request = vi.fn(async (route: string) => route === 'POST:/sites' ? site : {});
    const saveRevision = vi.fn(async () => ({}));
    const onProgress = vi.fn();

    await persistProjectDomainWorkflow({
      projectId: 'project-1', environmentId: 'env-1', form, target,
      currentRevision: null, completion: { site: false, binding: false, revision: false },
      request, saveRevision, onProgress,
    });

    expect(request.mock.calls.map(([route]) => route)).toEqual([
      'POST:/sites', 'PUT:/applications/app-1/services/service-1',
    ]);
    expect(request).toHaveBeenNthCalledWith(1, 'POST:/sites', expect.objectContaining({
      projectId: 'project-1', environmentId: 'env-1', primaryDomain: 'web.example.com',
    }));
    expect(saveRevision).toHaveBeenCalledWith(expect.objectContaining({
      changeSummary: '新增生产入口',
      routeSnapshot: expect.objectContaining({ entries: [expect.objectContaining({
        domain: 'web.example.com', serviceId: 'service-1', port: 8080,
      })] }),
    }));
    expect(onProgress).toHaveBeenLastCalledWith(
      { site: true, binding: true, revision: true }, site,
    );
  });

  it('retries a partial save by updating the created Site instead of creating a duplicate', async () => {
    const firstRequest = vi.fn(async (route: string) => {
      if (route === 'POST:/sites') return site;
      throw new Error('binding unavailable');
    });
    let progress = { site: false, binding: false, revision: false };
    let createdSite: Site | null = null;
    await expect(persistProjectDomainWorkflow({
      projectId: 'project-1', environmentId: 'env-1', form, target,
      currentRevision: null, completion: progress, request: firstRequest,
      saveRevision: vi.fn(), onProgress: (next, persisted) => {
        progress = next;
        createdSite = persisted;
      },
    })).rejects.toThrow('binding unavailable');

    const retryRequest = vi.fn(async (route: string) => route.startsWith('PUT:/sites/') ? site : {});
    const saveRevision = vi.fn(async () => ({}));
    await persistProjectDomainWorkflow({
      projectId: 'project-1', environmentId: 'env-1', form, target,
      currentRevision: null, completion: progress, createdSite,
      request: retryRequest, saveRevision, onProgress: vi.fn(),
    });

    expect(retryRequest.mock.calls.map(([route]) => route)).toEqual([
      'PUT:/sites/site-1', 'PUT:/applications/app-1/services/service-1',
    ]);
    expect(saveRevision).toHaveBeenCalledOnce();
  });
});
