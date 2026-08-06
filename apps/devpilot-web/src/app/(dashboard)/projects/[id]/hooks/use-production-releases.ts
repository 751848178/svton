'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import { useAuthStore, useTeamStore } from '@/store/hooks';
import type { ProductionReleasePreview, ProductionReleaseRun } from '../types/release-order.types';
import { scopedRequestIdentity, useScopedRequestGuard } from './use-scoped-request-guard';

interface ProductionState {
  scope: string;
  preview: ProductionReleasePreview | null;
  loading: boolean;
  confirming: boolean;
  error: string;
}

export function useProductionReleases(
  projectId: string,
  releaseOrderId: string,
  manifestId: string,
  onChanged: () => Promise<unknown>,
) {
  const actorId = useAuthStore().user?.id || '';
  const teamId = useTeamStore().currentTeam?.id || '';
  const active = Boolean(actorId && teamId);
  const scope = scopedRequestIdentity(actorId, teamId, projectId, releaseOrderId, manifestId);
  const { begin, isCurrent } = useScopedRequestGuard(scope);
  const [state, setState] = useState<ProductionState>(() => loadingState(scope));
  const confirmInFlight = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!active) {
      setState(inactiveState(scope));
      return;
    }
    const request = begin('preview');
    if (!isCurrent(request)) return;
    setState(loadingState(scope));
    try {
      const preview = manifestId
        ? await apiRequest<ProductionReleasePreview>(
            `GET:/projects/${projectId}/delivery/releases/${releaseOrderId}/production-preview?manifestId=${encodeURIComponent(manifestId)}`,
          )
        : null;
      if (!isCurrent(request)) return;
      if (preview && !ownsPreview(preview, projectId, releaseOrderId, manifestId)) {
        setState(failedState(scope, 'releaseProductionPreviewScopeMismatch'));
        return;
      }
      setState({ scope, preview, loading: false, confirming: false, error: '' });
    } catch (caught) {
      if (isCurrent(request)) setState(failedState(scope, message(caught)));
    }
  }, [active, begin, isCurrent, manifestId, projectId, releaseOrderId, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirm = useCallback(async () => {
    const preview = state.scope === scope ? state.preview : null;
    if (!active || !preview || confirmInFlight.current === scope) return null;
    if (!ownsPreview(preview, projectId, releaseOrderId, manifestId)) return null;
    const request = begin('confirm');
    if (!isCurrent(request)) return null;
    confirmInFlight.current = scope;
    setState((current) => ({
      ...(current.scope === scope ? current : loadingState(scope)),
      confirming: true,
      error: '',
    }));
    try {
      const run = await apiRequest<ProductionReleaseRun>(
        `POST:/projects/${projectId}/delivery/releases/${releaseOrderId}/production-releases`,
        {
          manifestId: preview.snapshot.manifest.id,
          expectedInputHash: preview.inputHash,
          idempotencyKey: crypto.randomUUID(),
        },
      );
      if (!isCurrent(request)) return null;
      if (run.projectId !== projectId || run.releaseOrderId !== releaseOrderId) {
        setState(failedState(scope, 'releaseProductionRunScopeMismatch'));
        return null;
      }
      await onChanged();
      return isCurrent(request) ? run : null;
    } catch (caught) {
      if (isCurrent(request)) setState(failedState(scope, message(caught)));
      return null;
    } finally {
      if (confirmInFlight.current === scope) confirmInFlight.current = null;
      if (isCurrent(request)) {
        setState((current) =>
          current.scope === scope ? { ...current, confirming: false } : current,
        );
      }
    }
  }, [active, begin, isCurrent, manifestId, onChanged, projectId, releaseOrderId, scope, state]);

  const ownsState = state.scope === scope;
  return {
    preview: ownsState ? state.preview : null,
    loading: !ownsState || state.loading,
    confirming: ownsState && state.confirming,
    error: ownsState ? state.error : '',
    load,
    confirm,
  };
}

function ownsPreview(
  preview: ProductionReleasePreview,
  projectId: string,
  releaseOrderId: string,
  manifestId: string,
) {
  return (
    preview.snapshot.projectId === projectId &&
    preview.snapshot.releaseOrder.id === releaseOrderId &&
    preview.snapshot.manifest.id === manifestId
  );
}

function loadingState(scope: string): ProductionState {
  return { scope, preview: null, loading: true, confirming: false, error: '' };
}

function inactiveState(scope: string): ProductionState {
  return { ...loadingState(scope), loading: false };
}

function failedState(scope: string, error: string): ProductionState {
  return { ...loadingState(scope), loading: false, error };
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
