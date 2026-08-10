'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import {
  deriveProjectName,
} from '../project-intake.utils';
import { errorMessage, mutate } from '../project-intake-mutation.utils';
import {
  INITIAL_INTAKE_FORM,
  type ProjectIntakeConnection,
  type ProjectIntakeCredentialOption,
  type ProjectIntakeFinalization,
  type ProjectIntakeForm,
  type ProjectIntakeProject,
  type ProjectIntakeRun,
} from '../types';
import { useRepositoryIntakeReview } from './use-repository-intake-review';
import { useProjectIntakeResume } from './use-project-intake-resume';

export function useProjectIntake() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<ProjectIntakeForm>(INITIAL_INTAKE_FORM);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [connection, setConnection] = useState<ProjectIntakeConnection | null>(null);
  const [credentialOptions, setCredentialOptions] = useState<ProjectIntakeCredentialOption[]>([]);
  const [run, setRun] = useState<ProjectIntakeRun | null>(null);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState('');
  const analysisRequest = useRef<{ signature: string; key: string } | null>(null);
  const finalizationKey = useRef<string | null>(null);

  const updateForm = useCallback((patch: Partial<ProjectIntakeForm>) => {
    setForm((current) => ({ ...current, ...patch }));
  }, []);

  useEffect(() => {
    void apiRequest<ProjectIntakeCredentialOption[]>('GET:/project-intake/credential-options')
      .then(setCredentialOptions)
      .catch(() => setCredentialOptions([]));
  }, []);

  const loadRun = useCallback(async (targetProjectId: string, runId: string) => {
    const detail = await apiRequest<ProjectIntakeRun>(
      `GET:/projects/${targetProjectId}/repository-analysis/runs/${runId}`,
    );
    setRun(detail);
    return detail;
  }, []);

  useEffect(() => {
    if (!projectId || !run || !['queued', 'running'].includes(run.status)) return;
    const timer = window.setInterval(() => {
      void loadRun(projectId, run.id).catch((caught) => setError(errorMessage(caught)));
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [loadRun, projectId, run]);

  const connectAndAnalyze = useCallback(async () => {
    setMutating(true);
    setError('');
    try {
      const name = form.name.trim() || deriveProjectName(form.repositoryUrl);
      let draftId = projectId;
      if (!draftId) {
        const draft = await apiRequest<ProjectIntakeProject>('POST:/project-intake/drafts', {
          name,
          description: form.description.trim() || undefined,
        });
        draftId = draft.id;
        setProjectId(draft.id);
        updateForm({ name });
      }
      const nextConnection = await apiRequest<ProjectIntakeConnection>(
        `POST:/project-intake/${draftId}/repository`,
        {
          repositoryUrl: form.repositoryUrl.trim(),
          branch: form.branch.trim() || undefined,
          visibility: form.visibility,
          ...(form.visibility === 'private' && form.credentialMode === 'managed'
            ? { teamCredentialId: form.teamCredentialId }
            : form.visibility === 'private'
            ? {
                credential: {
                  type: form.credentialType,
                  name: form.credentialName.trim(),
                  username: form.credentialUsername.trim() || undefined,
                  secret: form.credentialSecret,
                },
              }
            : {}),
        },
      );
      setConnection(nextConnection);
      updateForm({ credentialSecret: '' });
      const signature = [
        draftId,
        nextConnection.repositoryUrl,
        nextConnection.selectedBranch,
        nextConnection.commitSha,
      ].join(':');
      if (analysisRequest.current?.signature !== signature) {
        analysisRequest.current = { signature, key: window.crypto.randomUUID() };
      }
      const nextRun = await apiRequest<ProjectIntakeRun>(
        `POST:/project-intake/${draftId}/analysis-runs`,
        {
          branch: nextConnection.selectedBranch ?? undefined,
          idempotencyKey: analysisRequest.current.key,
        },
      );
      setRun(nextRun);
      setStep(2);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setMutating(false);
    }
  }, [form, projectId, updateForm]);

  const retryAnalysis = useCallback(async () => {
    if (!projectId || !run) return;
    await mutate(
      async () => {
        const nextRun = await apiRequest<ProjectIntakeRun>(
          `POST:/project-intake/${projectId}/analysis-runs/${run.id}/retry`,
        );
        setRun(nextRun);
      },
      setMutating,
      setError,
    );
  }, [projectId, run]);

  const review = useRepositoryIntakeReview({
    projectId,
    run,
    setStep,
    setMutating,
    setError,
  });
  useProjectIntakeResume({
    projectId, run, setProjectId, setConnection, setRun, setForm, setStep, setError,
  });

  const finalize = useCallback(async () => {
    const snapshot = review.contract?.snapshot;
    if (!projectId || !run || run.status !== 'succeeded' || !snapshot) return null;
    finalizationKey.current ??= window.crypto.randomUUID();
    return mutate(
      () =>
        apiRequest<ProjectIntakeFinalization>(`POST:/project-intake/${projectId}/finalize`, {
          analysisRunId: run.id,
          reviewSnapshotId: snapshot.id,
          reviewSnapshotHash: snapshot.hash,
          idempotencyKey: finalizationKey.current,
        }),
      setMutating,
      setError,
    );
  }, [projectId, review.contract?.snapshot, run]);

  return {
    step,
    setStep,
    form,
    updateForm,
    projectId,
    connection,
    credentialOptions,
    run,
    mutating,
    error,
    connectAndAnalyze,
    retryAnalysis,
    ...review,
    finalize,
  };
}

export type ProjectIntakeHook = ReturnType<typeof useProjectIntake>;
