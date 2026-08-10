'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import { useAuthStore, useTeamStore } from '@/store/hooks';
import type {
  ReleaseStagingDeploymentItem,
  ReleaseStagingDeploymentListResponse,
} from '../types/release-order.types';
import { isReleaseStagingActive } from '../utils/release-staging-view.model';
import { scopedRequestIdentity, useScopedRequestGuard } from './use-scoped-request-guard';

interface DeploymentsState {
  scope: string;
  items: ReleaseStagingDeploymentItem[];
  total: number;
  loading: boolean;
  loadedSuccessfully: boolean;
  deploying: boolean;
  error: string;
}

export function useReleaseStagingDeployments(
  projectId: string,
  releaseOrderId: string,
  onChanged?: () => Promise<unknown>,
) {
  const actorId = useAuthStore().user?.id || '';
  const teamId = useTeamStore().currentTeam?.id || '';
  const active = Boolean(actorId && teamId);
  const scope = scopedRequestIdentity(actorId, teamId, projectId, releaseOrderId);
  const { begin, invalidate, isCurrent } = useScopedRequestGuard(scope);
  const [state, setState] = useState<DeploymentsState>(() => loadingState(scope));
  const deployInFlight = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!active) {
      setState(inactiveState(scope));
      return;
    }
    const request = begin('list');
    if (!isCurrent(request)) return;
    setState((current) => ({
      ...(current.scope === scope ? current : loadingState(scope)),
      loading: true,
      error: '',
    }));
    try {
      const result = await apiRequest<ReleaseStagingDeploymentListResponse>(
        `GET:/projects/${projectId}/delivery/releases/${releaseOrderId}/staging-deployments`,
      );
      if (!isCurrent(request)) return;
      if (result.items.some((item) => !ownsScope(item, projectId, releaseOrderId))) {
        setState((current) => failedState(scope, current, 'releaseStagingScopeMismatch'));
        return;
      }
      setState((current) => ({
        scope,
        items: result.items,
        total: result.total,
        loading: false,
        loadedSuccessfully: true,
        deploying: current.scope === scope && current.deploying,
        error: '',
      }));
    } catch (caught) {
      if (isCurrent(request)) {
        setState((current) => failedState(scope, current, message(caught)));
      }
    }
  }, [active, begin, isCurrent, projectId, releaseOrderId, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const shouldPoll =
    state.scope === scope && state.items.some((item) => isReleaseStagingActive(item.status));
  useEffect(() => {
    if (!active || !shouldPoll) return;
    const timer = setInterval(() => void load(), 5_000);
    return () => clearInterval(timer);
  }, [active, load, shouldPoll]);

  const deploy = useCallback(
    async (manifestId: string) => {
      if (!active || deployInFlight.current === scope) return null;
      const request = begin('deploy');
      if (!isCurrent(request)) return null;
      deployInFlight.current = scope;
      setState((current) => ({
        ...(current.scope === scope ? current : loadingState(scope)),
        deploying: true,
        error: '',
      }));
      try {
        const run = await apiRequest<ReleaseStagingDeploymentItem>(
          `POST:/projects/${projectId}/delivery/releases/${releaseOrderId}/staging-deployments`,
          { manifestId },
        );
        if (!isCurrent(request)) return null;
        if (!ownsScope(run, projectId, releaseOrderId)) {
          setState((current) => failedState(scope, current, 'releaseStagingScopeMismatch'));
          return null;
        }
        invalidate('list');
        setState((current) => {
          const ownsCurrent = current.scope === scope;
          const prior = ownsCurrent ? current.items : [];
          const priorTotal = ownsCurrent ? current.total : 0;
          const increment = prior.some((item) => item.id === run.id) ? 0 : 1;
          return {
            ...(ownsCurrent ? current : loadingState(scope)),
            items: [run, ...prior.filter((item) => item.id !== run.id)],
            total: Math.max(priorTotal + increment, prior.length + increment),
          };
        });
        await onChanged?.();
        return isCurrent(request) ? run : null;
      } catch (caught) {
        if (isCurrent(request)) {
          setState((current) => ({
            ...(current.scope === scope ? current : loadingState(scope)),
            error: message(caught),
          }));
        }
        return null;
      } finally {
        if (deployInFlight.current === scope) deployInFlight.current = null;
        if (isCurrent(request)) {
          setState((current) =>
            current.scope === scope ? { ...current, deploying: false } : current,
          );
        }
      }
    },
    [active, begin, invalidate, isCurrent, onChanged, projectId, releaseOrderId, scope],
  );

  const ownsState = state.scope === scope;
  return {
    items: ownsState ? state.items : [],
    total: ownsState ? state.total : 0,
    loading: !ownsState || state.loading,
    loadedSuccessfully: ownsState && state.loadedSuccessfully,
    deploying: ownsState && state.deploying,
    error: ownsState ? state.error : '',
    load,
    deploy,
  };
}

function ownsScope(item: ReleaseStagingDeploymentItem, projectId: string, releaseOrderId: string) {
  return item.projectId === projectId && item.releaseOrderId === releaseOrderId;
}

function loadingState(scope: string): DeploymentsState {
  return {
    scope,
    items: [],
    total: 0,
    loading: true,
    loadedSuccessfully: false,
    deploying: false,
    error: '',
  };
}

function inactiveState(scope: string): DeploymentsState {
  return { ...loadingState(scope), loading: false };
}

function failedState(scope: string, current: DeploymentsState, error: string): DeploymentsState {
  const ownsState = current.scope === scope;
  return {
    scope,
    items: ownsState ? current.items : [],
    total: ownsState ? current.total : 0,
    loading: false,
    loadedSuccessfully: ownsState && current.loadedSuccessfully,
    deploying: ownsState && current.deploying,
    error,
  };
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
