'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import type { ReleaseBuildItem, ReleaseBuildListResponse } from '../types/release-order.types';
import { isReleaseBuildActive } from '../components/release-build-view.model';
import { scopedRequestIdentity, useScopedRequestGuard } from './use-scoped-request-guard';

interface BuildsState {
  scope: string;
  items: ReleaseBuildItem[];
  total: number;
  loading: boolean;
  loadedSuccessfully: boolean;
  building: boolean;
  error: string;
}

export function useReleaseBuilds(
  projectId: string,
  releaseOrderId: string,
  onChanged: () => Promise<unknown>,
  enabled = true,
  historyLimit?: number,
) {
  const scope = scopedRequestIdentity(projectId, releaseOrderId);
  const { begin, invalidate, isCurrent } = useScopedRequestGuard(scope);
  const [state, setState] = useState<BuildsState>(() => loadingState(scope, false));
  const buildInFlight = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    const request = begin('list');
    if (!isCurrent(request)) return;
    setState((current) =>
      current.scope === scope
        ? { ...current, loading: true, error: '' }
        : loadingState(scope, false),
    );
    try {
      const result = await apiRequest<ReleaseBuildListResponse>(
        `GET:/projects/${projectId}/delivery/releases/${releaseOrderId}/builds${historyLimit ? `?take=${historyLimit}` : ''}`,
      );
      if (!isCurrent(request)) return;
      if (result.items.some((item) => item.releaseOrderId !== releaseOrderId)) {
        setState((current) => failedState(scope, current, 'Release build scope mismatch'));
        return;
      }
      setState((current) => ({
        scope,
        items: result.items,
        total: result.total,
        loading: false,
        loadedSuccessfully: true,
        building: current.scope === scope && current.building,
        error: '',
      }));
    } catch (caught) {
      if (isCurrent(request)) {
        setState((current) => failedState(scope, current, errorMessage(caught)));
      }
    }
  }, [begin, enabled, historyLimit, isCurrent, projectId, releaseOrderId, scope]);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  const shouldPoll =
    state.scope === scope &&
    (state.building || state.items.some((item) => isReleaseBuildActive(item.status)));
  useEffect(() => {
    if (!enabled || !shouldPoll) return;
    const timer = setInterval(() => void load(), 5_000);
    return () => clearInterval(timer);
  }, [enabled, load, shouldPoll]);

  const buildLatest = useCallback(async () => {
    if (!enabled || buildInFlight.current === scope) return null;
    const request = begin('build');
    if (!isCurrent(request)) return null;
    buildInFlight.current = scope;
    setState((current) => ({
      ...(current.scope === scope ? current : loadingState(scope, false)),
      building: true,
      error: '',
    }));
    try {
      const run = await apiRequest<ReleaseBuildItem>(
        `POST:/projects/${projectId}/delivery/releases/${releaseOrderId}/builds`,
        {},
      );
      if (!isCurrent(request)) return null;
      if (run.releaseOrderId !== releaseOrderId) {
        setState((current) => failedState(scope, current, 'Release build scope mismatch'));
        return null;
      }
      invalidate('list');
      setState((current) => {
        const ownsScope = current.scope === scope;
        const prior = ownsScope ? current.items : [];
        const increment = prior.some((item) => item.id === run.id) ? 0 : 1;
        const items = [run, ...prior.filter((item) => item.id !== run.id)].slice(
          0,
          historyLimit ?? Number.POSITIVE_INFINITY,
        );
        return {
          ...(ownsScope ? current : loadingState(scope, false)),
          items,
          total: ownsScope ? Math.max(current.total + increment, prior.length + increment) : 1,
        };
      });
      await onChanged();
      return isCurrent(request) ? run : null;
    } catch (caught) {
      if (isCurrent(request)) {
        setState((current) => ({
          ...(current.scope === scope ? current : loadingState(scope, false)),
          error: errorMessage(caught),
        }));
      }
      return null;
    } finally {
      if (buildInFlight.current === scope) buildInFlight.current = null;
      if (isCurrent(request)) {
        setState((current) =>
          current.scope === scope ? { ...current, building: false } : current,
        );
      }
    }
  }, [
    begin,
    enabled,
    historyLimit,
    invalidate,
    isCurrent,
    onChanged,
    projectId,
    releaseOrderId,
    scope,
  ]);

  const ownsState = state.scope === scope;
  return {
    scope: ownsState ? scope : null,
    successfulScope: ownsState && state.loadedSuccessfully ? scope : null,
    items: ownsState ? state.items : [],
    total: ownsState ? state.total : 0,
    loading: !ownsState || state.loading,
    loadedSuccessfully: ownsState && state.loadedSuccessfully,
    building: ownsState && state.building,
    error: ownsState ? state.error : '',
    load,
    buildLatest,
  };
}

export type ReleaseBuildsController = ReturnType<typeof useReleaseBuilds>;

function loadingState(scope: string, building: boolean): BuildsState {
  return {
    scope,
    items: [],
    total: 0,
    loading: true,
    loadedSuccessfully: false,
    building,
    error: '',
  };
}

function failedState(scope: string, current: BuildsState, error: string): BuildsState {
  const ownsState = current.scope === scope;
  return {
    scope,
    items: ownsState ? current.items : [],
    total: ownsState ? current.total : 0,
    loading: false,
    loadedSuccessfully: ownsState && current.loadedSuccessfully,
    building: ownsState && current.building,
    error,
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
