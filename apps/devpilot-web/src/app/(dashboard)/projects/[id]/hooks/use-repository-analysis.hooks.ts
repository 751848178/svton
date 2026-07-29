'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import type {
  ConnectRepositoryInput,
  RepositoryAnalysisRun,
  RepositoryAnalysisState,
  RepositoryApplyResult,
  RepositorySuggestionDecision,
} from '../types/repository-analysis.types';

const EMPTY_STATE: RepositoryAnalysisState = {
  connection: null,
  credentialOptions: [],
  readiness: { connected: false, analyzed: false, applied: false, complete: false },
};

export function useRepositoryAnalysis(projectId: string, focusedRunId?: string) {
  const base = `/projects/${projectId}/repository-analysis`;
  const [state, setState] = useState<RepositoryAnalysisState>(EMPTY_STATE);
  const [runs, setRuns] = useState<RepositoryAnalysisRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<RepositoryAnalysisRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState('');
  const [applyResult, setApplyResult] = useState<RepositoryApplyResult | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const [nextState, nextRuns] = await Promise.all([
        apiRequest<RepositoryAnalysisState>(`GET:${base}`),
        apiRequest<RepositoryAnalysisRun[]>(`GET:${base}/runs`),
      ]);
      const runId = focusedRunId || selectedRun?.id || nextRuns[0]?.id;
      const detail = runId
        ? await apiRequest<RepositoryAnalysisRun>(`GET:${base}/runs/${runId}`)
        : null;
      setState(nextState);
      setRuns(nextRuns);
      setSelectedRun(detail);
      setError('');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [base, focusedRunId, projectId, selectedRun?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = useMemo(
    () => runs.some((run) => run.status === 'queued' || run.status === 'running'),
    [runs],
  );

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => void load(), 2_000);
    return () => window.clearInterval(timer);
  }, [active, load]);

  const mutate = useCallback(async <T,>(operation: () => Promise<T>) => {
    setMutating(true);
    setError('');
    try {
      const result = await operation();
      await load();
      return result;
    } catch (caught) {
      setError(errorMessage(caught));
      throw caught;
    } finally {
      setMutating(false);
    }
  }, [load]);

  const connectAndAnalyze = useCallback((input: ConnectRepositoryInput) =>
    mutate(async () => {
      const connection = await apiRequest<{ selectedBranch?: string }>(
        `POST:${base}/connect`,
        input,
      );
      return apiRequest<RepositoryAnalysisRun>(`POST:${base}/runs`, {
        branch: connection.selectedBranch,
        idempotencyKey: window.crypto.randomUUID(),
      });
    }), [base, mutate]);

  const start = useCallback(() => mutate(() =>
    apiRequest<RepositoryAnalysisRun>(`POST:${base}/runs`, {
      branch: state.connection?.selectedBranch,
      idempotencyKey: window.crypto.randomUUID(),
    })), [base, mutate, state.connection?.selectedBranch]);

  const retry = useCallback((runId: string) => mutate(() =>
    apiRequest<RepositoryAnalysisRun>(`POST:${base}/runs/${runId}/retry`)),
  [base, mutate]);

  const cancel = useCallback((runId: string) => mutate(() =>
    apiRequest(`POST:${base}/runs/${runId}/cancel`)),
  [base, mutate]);

  const apply = useCallback((runId: string, decisions: RepositorySuggestionDecision[]) =>
    mutate(async () => {
      const result = await apiRequest<RepositoryApplyResult>(
        `POST:${base}/runs/${runId}/apply`,
        { decisions },
      );
      setApplyResult(result);
      return result;
    }), [base, mutate]);

  return {
    projectId,
    state,
    runs,
    selectedRun,
    loading,
    mutating,
    error,
    active,
    applyResult,
    load,
    setSelectedRun,
    connectAndAnalyze,
    start,
    retry,
    cancel,
    apply,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export type RepositoryAnalysisHook = ReturnType<typeof useRepositoryAnalysis>;
