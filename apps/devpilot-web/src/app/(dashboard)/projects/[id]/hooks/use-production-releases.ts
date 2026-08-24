'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import { useAuthStore, useTeamStore } from '@/store/hooks';
import type { ProductionReleasePreview, ProductionReleaseRun } from '../types/release-order.types';
import { scopedRequestIdentity, useScopedRequestGuard } from './use-scoped-request-guard';

/** ROD-2：区分后台预览加载失败（load）与用户操作失败（action），只有后者渲染失败 alert。 */
export type ProductionErrorKind = 'load' | 'action' | null;

interface ProductionState {
  scope: string;
  preview: ProductionReleasePreview | null;
  loading: boolean;
  confirming: boolean;
  refreshing: boolean;
  error: string;
  errorKind: ProductionErrorKind;
}

export function useProductionReleases(
  projectId: string,
  releaseOrderId: string,
  manifestId: string,
  onChanged: () => Promise<unknown>,
  enabled = true,
) {
  const actorId = useAuthStore().user?.id || '';
  const teamId = useTeamStore().currentTeam?.id || '';
  const active = Boolean(enabled && actorId && teamId);
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
        setState(failedState(scope, 'releaseProductionPreviewScopeMismatch', 'load'));
        return;
      }
      setState({
        scope,
        preview,
        loading: false,
        confirming: false,
        refreshing: false,
        error: '',
        errorKind: null,
      });
    } catch (caught) {
      if (isCurrent(request)) setState(failedState(scope, message(caught), 'load'));
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
      errorKind: null,
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
        setState(failedState(scope, 'releaseProductionRunScopeMismatch', 'action'));
        return null;
      }
      await onChanged();
      return isCurrent(request) ? run : null;
    } catch (caught) {
      if (isCurrent(request)) setState(failedState(scope, message(caught), 'action'));
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

  const refreshPreflight = useCallback(async () => {
    const preview = state.scope === scope ? state.preview : null;
    if (!active || !preview || !ownsPreview(preview, projectId, releaseOrderId, manifestId)) {
      return null;
    }
    const request = begin('preflight-refresh');
    if (!isCurrent(request)) return null;
    setState((current) =>
      current.scope === scope
        ? { ...current, refreshing: true, error: '', errorKind: null }
        : current,
    );
    try {
      const refreshed = await apiRequest<ProductionReleasePreview>(
        `POST:/projects/${projectId}/delivery/releases/${releaseOrderId}/production-preflight-refresh`,
        { manifestId },
      );
      if (!isCurrent(request) || !ownsPreview(refreshed, projectId, releaseOrderId, manifestId)) {
        return null;
      }
      setState({
        scope,
        preview: refreshed,
        loading: false,
        confirming: false,
        refreshing: false,
        error: '',
        errorKind: null,
      });
      return refreshed;
    } catch (caught) {
      if (isCurrent(request)) setState(failedState(scope, message(caught), 'action'));
      return null;
    }
  }, [active, begin, isCurrent, manifestId, projectId, releaseOrderId, scope, state]);

  const ownsState = state.scope === scope;
  return {
    preview: ownsState ? state.preview : null,
    loading: !ownsState || state.loading,
    confirming: ownsState && state.confirming,
    refreshing: ownsState && state.refreshing,
    error: ownsState ? state.error : '',
    errorKind: ownsState ? state.errorKind : null,
    load,
    confirm,
    refreshPreflight,
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
  return {
    scope,
    preview: null,
    loading: true,
    confirming: false,
    refreshing: false,
    error: '',
    errorKind: null,
  };
}

function inactiveState(scope: string): ProductionState {
  return { ...loadingState(scope), loading: false };
}

function failedState(
  scope: string,
  error: string,
  errorKind: Exclude<ProductionErrorKind, null>,
): ProductionState {
  return { ...loadingState(scope), loading: false, error, errorKind };
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
