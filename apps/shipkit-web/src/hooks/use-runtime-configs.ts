'use client';
import { useState } from 'react';
import type { Project } from '@/lib/contracts';
import type { ConfigDraft, ConfigVersion } from '@/lib/config-contracts';
import { request } from '@/lib/api';
import { useApi } from './use-api';

export function useRuntimeConfigs(project: Project, targetKey: string) {
  const scope = { projectId: project.id, targetKey };
  const drafts = useApi('GET:/projects/:projectId/configs/:targetKey/drafts', scope);
  const versions = useApi('GET:/projects/:projectId/configs/:targetKey/versions', scope);
  const [draft, setDraft] = useState<ConfigDraft | null>(null);
  const [detail, setDetail] = useState<ConfigVersion | null>(null);
  const [action, setAction] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const refresh = () => { void drafts.mutate(); void versions.mutate(); };
  const run = async (name: string, operation: () => Promise<void>) => {
    if (action) return;
    setAction(name); setError(null);
    try { await operation(); } catch (failure) { setError(failure); } finally { setAction(null); }
  };
  const create = (name: string, baseVersionId?: string) => run('create', async () => {
    const value = await request('POST:/projects/:projectId/configs/:targetKey/drafts', { ...scope, name: name.trim(), ...(baseVersionId ? { baseVersionId } : { services: project.services.map(service => ({ serviceKey: service.serviceKey, noEnv: false })) }) });
    setDraft(value); setDetail(null); refresh();
  });
  const open = (id: string) => run('open', async () => { setDraft(await request('GET:/projects/:projectId/configs/:targetKey/drafts/:id', { ...scope, id })); setDetail(null); });
  const inspect = (id: string) => run('inspect', async () => { setDetail(await request('GET:/projects/:projectId/configs/:targetKey/versions/:id', { ...scope, id })); });
  const archive = (id: string) => run('archive', async () => { await request('POST:/projects/:projectId/configs/:targetKey/versions/:id/archive', { ...scope, id }); setDetail(null); refresh(); });
  return { scope, drafts, versions, draft, detail, action, error, refresh, create, open, inspect, archive, setDetail, close: () => setDraft(null), saved: (value: ConfigDraft) => { setDraft(value); refresh(); }, frozen: () => { setDraft(null); refresh(); } };
}
