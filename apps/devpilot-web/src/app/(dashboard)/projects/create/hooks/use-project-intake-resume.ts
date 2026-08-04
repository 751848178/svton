'use client';

import { useEffect, useRef } from 'react';
import { apiRequest } from '@/lib/api-client';
import { errorMessage } from '../project-intake-mutation.utils';
import type {
  ProjectIntakeConnection,
  ProjectIntakeForm,
  ProjectIntakeRun,
  ProjectIntakeState,
} from '../types';

interface Options {
  projectId: string | null;
  run: ProjectIntakeRun | null;
  setProjectId: (value: string) => void;
  setConnection: (value: ProjectIntakeConnection | null) => void;
  setRun: (value: ProjectIntakeRun) => void;
  setForm: React.Dispatch<React.SetStateAction<ProjectIntakeForm>>;
  setStep: (value: number) => void;
  setError: (value: string) => void;
}

export function useProjectIntakeResume(options: Options) {
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const query = new URLSearchParams(window.location.search);
    const projectId = query.get('projectId');
    const runId = query.get('runId');
    if (!projectId || !runId) return;
    void Promise.all([
      apiRequest<ProjectIntakeState>(`GET:/project-intake/${projectId}`),
      apiRequest<ProjectIntakeRun>(`GET:/projects/${projectId}/repository-analysis/runs/${runId}`),
    ]).then(([state, run]) => {
      options.setProjectId(projectId);
      options.setConnection(state.repository.connection);
      options.setRun(run);
      options.setForm((current) => ({
        ...current,
        name: state.project.name,
        description: state.project.description || '',
        repositoryUrl: state.repository.connection?.repositoryUrl || '',
        branch: state.repository.connection?.selectedBranch || '',
        visibility: state.repository.connection?.visibility === 'private' ? 'private' : 'public',
        credentialMode: 'managed',
        teamCredentialId: state.repository.connection?.teamCredentialId
          || state.repository.connection?.gitConnectionId || '',
        credentialSecret: '',
      }));
      options.setStep(2);
    }).catch((caught) => options.setError(errorMessage(caught)));
  }, [options]);

  useEffect(() => {
    if (!options.projectId || !options.run) return;
    const url = new URL(window.location.href);
    url.searchParams.set('projectId', options.projectId);
    url.searchParams.set('runId', options.run.id);
    window.history.replaceState(null, '', url);
  }, [options.projectId, options.run?.id]);
}
