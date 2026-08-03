'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import {
  buildSuggestionDecisions,
  deriveProjectName,
  isRequiredEnvironmentSuggestion,
} from '../project-intake.utils';
import { errorMessage, mutate } from '../project-intake-mutation.utils';
import {
  INITIAL_INTAKE_FORM,
  type ProjectIntakeConnection,
  type ProjectIntakeFinalization,
  type ProjectIntakeForm,
  type ProjectIntakeProject,
  type ProjectIntakeRun,
} from '../types';

export function useProjectIntake() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<ProjectIntakeForm>(INITIAL_INTAKE_FORM);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [connection, setConnection] = useState<ProjectIntakeConnection | null>(null);
  const [run, setRun] = useState<ProjectIntakeRun | null>(null);
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<Set<string>>(new Set());
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState('');
  const analysisRequest = useRef<{ signature: string; key: string } | null>(null);
  const finalizationKey = useRef<string | null>(null);

  const updateForm = useCallback((patch: Partial<ProjectIntakeForm>) => {
    setForm((current) => ({ ...current, ...patch }));
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

  useEffect(() => {
    if (run?.status !== 'succeeded') return;
    setSelectedSuggestionIds(
      new Set(
        (run.suggestions ?? [])
          .filter((suggestion) => suggestion.status === 'pending')
          .map((suggestion) => suggestion.id),
      ),
    );
  }, [run?.id, run?.status]);

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
          ...(form.visibility === 'private'
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

  const confirmAnalysis = useCallback(async () => {
    if (!projectId || !run || run.status !== 'succeeded') return;
    await mutate(
      async () => {
        await apiRequest(`POST:/project-intake/${projectId}/analysis-runs/${run.id}/review`, {
          decisions: buildSuggestionDecisions(run, selectedSuggestionIds),
        });
        setStep(3);
      },
      setMutating,
      setError,
    );
  }, [projectId, run, selectedSuggestionIds]);

  const finalize = useCallback(async () => {
    if (!projectId || !run || run.status !== 'succeeded') return null;
    finalizationKey.current ??= window.crypto.randomUUID();
    return mutate(
      () =>
        apiRequest<ProjectIntakeFinalization>(`POST:/project-intake/${projectId}/finalize`, {
          analysisRunId: run.id,
          idempotencyKey: finalizationKey.current,
        }),
      setMutating,
      setError,
    );
  }, [projectId, run]);

  const toggleSuggestion = useCallback(
    (suggestionId: string) => {
      if (run && isRequiredEnvironmentSuggestion(run, selectedSuggestionIds, suggestionId)) return;
      setSelectedSuggestionIds((current) => {
        const next = new Set(current);
        if (next.has(suggestionId)) next.delete(suggestionId);
        else next.add(suggestionId);
        return next;
      });
    },
    [run, selectedSuggestionIds],
  );

  return {
    step,
    setStep,
    form,
    updateForm,
    projectId,
    connection,
    run,
    selectedSuggestionIds,
    toggleSuggestion,
    mutating,
    error,
    connectAndAnalyze,
    retryAnalysis,
    confirmAnalysis,
    finalize,
  };
}

export type ProjectIntakeHook = ReturnType<typeof useProjectIntake>;
