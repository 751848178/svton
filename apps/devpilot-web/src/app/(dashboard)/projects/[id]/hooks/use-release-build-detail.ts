'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@svton/api-client';
import { apiRequest } from '@/lib/api-client';
import type { ReleaseBuildItem } from '../types/release-order.types';

interface DetailState {
  key: string;
  run: ReleaseBuildItem | null;
  loaded: boolean;
  error: string;
  notFound: boolean;
}

export function useReleaseBuildDetail(
  projectId: string,
  releaseOrderId: string,
  buildRunId: string | undefined,
  summary: ReleaseBuildItem | null,
) {
  const key = `${projectId}\u0000${releaseOrderId}\u0000${buildRunId || ''}`;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<DetailState>({
    key: '',
    run: null,
    loaded: false,
    error: '',
    notFound: false,
  });
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (!buildRunId) {
      setState({ key, run: null, loaded: true, error: '', notFound: false });
      return;
    }
    let current = true;
    setState({ key, run: null, loaded: false, error: '', notFound: false });
    void apiRequest<ReleaseBuildItem>(
      `GET:/projects/${projectId}/delivery/releases/${releaseOrderId}/builds/${buildRunId}`,
    )
      .then((run) => {
        if (!current) return;
        const ownsScope = run.id === buildRunId && run.releaseOrderId === releaseOrderId;
        setState({
          key,
          run: ownsScope ? run : null,
          loaded: true,
          error: '',
          notFound: !ownsScope,
        });
      })
      .catch((caught: unknown) => {
        if (!current) return;
        const notFound = caught instanceof ApiError && String(caught.code) === '404';
        setState({
          key,
          run: null,
          loaded: true,
          error: notFound ? '' : errorMessage(caught),
          notFound,
        });
      });
    return () => {
      current = false;
    };
  }, [attempt, buildRunId, key, projectId, releaseOrderId]);

  if (state.key !== key) {
    return { run: summary, loaded: false, error: '', notFound: false, retry };
  }
  return {
    ...state,
    run: state.notFound ? null : state.run || summary,
    retry,
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
