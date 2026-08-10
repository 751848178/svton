'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import type { ReleaseOrderDetail } from '../types/release-order.types';
import { scopedRequestIdentity, useScopedRequestGuard } from './use-scoped-request-guard';

interface DetailState {
  scope: string;
  detail: ReleaseOrderDetail | null;
  loading: boolean;
  error: string;
}

export function useReleaseOrderDetail(projectId: string, releaseOrderId: string) {
  const scope = scopedRequestIdentity(projectId, releaseOrderId);
  const { begin, isCurrent } = useScopedRequestGuard(scope);
  const [state, setState] = useState<DetailState>(() => loadingState(scope));

  const load = useCallback(async () => {
    const request = begin('detail');
    if (!isCurrent(request)) return;
    setState(loadingState(scope));
    try {
      const result = await apiRequest<ReleaseOrderDetail>(
        `GET:/projects/${projectId}/delivery/releases/${releaseOrderId}`,
      );
      if (!isCurrent(request)) return;
      if (result.projectId !== projectId || result.id !== releaseOrderId) {
        setState(failedState(scope, 'Release order scope mismatch'));
        return;
      }
      setState({ scope, detail: result, loading: false, error: '' });
    } catch (caught) {
      if (isCurrent(request)) setState(failedState(scope, errorMessage(caught)));
    }
  }, [begin, isCurrent, projectId, releaseOrderId, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const ownsState = state.scope === scope;
  return {
    scope: ownsState ? scope : null,
    detail: ownsState ? state.detail : null,
    loading: !ownsState || state.loading,
    error: ownsState ? state.error : '',
    load,
  };
}

function loadingState(scope: string): DetailState {
  return { scope, detail: null, loading: true, error: '' };
}

function failedState(scope: string, error: string): DetailState {
  return { scope, detail: null, loading: false, error };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
