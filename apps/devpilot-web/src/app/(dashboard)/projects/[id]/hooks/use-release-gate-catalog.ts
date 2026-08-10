'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import type { ReleaseGateCatalog } from '../types/release-gate.types';
import { scopedRequestIdentity, useScopedRequestGuard } from './use-scoped-request-guard';

interface CatalogState {
  scope: string;
  catalog: ReleaseGateCatalog | null;
  loading: boolean;
  error: string;
}

export function useReleaseGateCatalog(projectId: string, releaseOrderId: string) {
  const scope = scopedRequestIdentity(projectId, releaseOrderId);
  const { begin, isCurrent } = useScopedRequestGuard(scope);
  const [state, setState] = useState<CatalogState>(() => loadingState(scope));

  const load = useCallback(async () => {
    const request = begin('catalog');
    if (!isCurrent(request)) return;
    setState(loadingState(scope));
    try {
      const result = await apiRequest<ReleaseGateCatalog>(
        `GET:/projects/${projectId}/delivery/releases/${releaseOrderId}/gates`,
      );
      if (!isCurrent(request)) return;
      if (result.releaseOrder.id !== releaseOrderId) {
        setState(failedState(scope, 'Release gate catalog scope mismatch'));
        return;
      }
      setState({ scope, catalog: result, loading: false, error: '' });
    } catch (cause) {
      if (isCurrent(request)) setState(failedState(scope, errorMessage(cause)));
    }
  }, [begin, isCurrent, projectId, releaseOrderId, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const ownsState = state.scope === scope;
  return {
    catalog: ownsState ? state.catalog : null,
    loading: !ownsState || state.loading,
    error: ownsState ? state.error : '',
    load,
  };
}

function loadingState(scope: string): CatalogState {
  return { scope, catalog: null, loading: true, error: '' };
}

function failedState(scope: string, error: string): CatalogState {
  return { scope, catalog: null, loading: false, error };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
