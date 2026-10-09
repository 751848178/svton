'use client';
import { useEffect, useState } from 'react';
import type { Project } from '@/lib/contracts';
import type { RepositoryInput, RepositoryPreview } from '@/lib/source-contracts';
import { emptyRepository, repositoryInput } from '@/lib/repository-input';
import { request } from '@/lib/api';
import { useApi } from './use-api';

export function useRepositorySettings(project: Project, onRefresh: () => void) {
  const query = useApi(project.sourceKind === 'repository' ? 'GET:/projects/:id/repository' : null, { id: project.id });
  const [value, setValue] = useState<RepositoryInput>(project.repository || emptyRepository);
  const [baseRevision, setBaseRevision] = useState(project.repository?.revision);
  const [edited, setEdited] = useState(false);
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [clearUsername, setClearUsername] = useState(false);
  const [clearCredential, setClearCredential] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState<RepositoryPreview | null>(null);
  useEffect(() => { if (query.data && !edited) { setValue(query.data.repository); setBaseRevision(query.data.repository.revision); } }, [query.data?.repository.revision, edited]);
  const edit = (next: RepositoryInput) => { setValue(next); setEdited(true); setSaved(false); setPreview(null); };
  const credentialInput = () => clearCredential ? { token: null } : { ...(token ? { token } : {}), ...(clearUsername ? { username: null } : username.trim() ? { username: username.trim() } : {}) };
  const read = async () => {
    if (busy) return;
    setBusy(true); setError(null); setPreview(null); setSaved(false);
    try { setPreview(await request('POST:/projects/:id/repository/preview', { id: project.id, repository: repositoryInput(value), ...credentialInput() })); }
    catch (failure) { setError(failure); } finally { setBusy(false); }
  };
  const save = async () => {
    if (baseRevision === undefined || busy || !preview) return;
    setBusy(true); setSaved(false); setError(null);
    try {
      const result = await request('PATCH:/projects/:id/repository', { id: project.id, revision: baseRevision, repository: repositoryInput(value), expectedCommit: preview.sourceSnapshot.commit, ...credentialInput() });
      setValue(result.repository); setBaseRevision(result.repository.revision); setEdited(false); setToken(''); setUsername(''); setClearUsername(false); setClearCredential(false); setPreview(null); await query.mutate(result, false); setSaved(true); onRefresh();
    } catch (failure) { setError(failure); } finally { setBusy(false); }
  };
  const credentialEdited = () => { setEdited(true); setPreview(null); setSaved(false); };
  return { query, value, edit, token, setToken: (next: string) => { setToken(next); credentialEdited(); }, username, setUsername: (next: string) => { setUsername(next); credentialEdited(); }, clearUsername, setClearUsername: (next: boolean) => { setClearUsername(next); credentialEdited(); }, clearCredential, setClearCredential: (next: boolean) => { setClearCredential(next); credentialEdited(); }, remoteChanged: edited && query.data?.repository.revision !== baseRevision, busy, error, saved, preview, read, save };
}
