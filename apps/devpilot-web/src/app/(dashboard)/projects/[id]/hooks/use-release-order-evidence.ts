'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import { useAuthStore, useTeamStore } from '@/store/hooks';
import type { ReleaseOrderEvidence } from '../types/release-order-evidence.types';
import { ownsReleaseOrderEvidence } from '../utils/release-order-evidence-ownership.utils';
import { scopedRequestIdentity, useScopedRequestGuard } from './use-scoped-request-guard';

interface EvidenceState {
  scope: string;
  evidence: ReleaseOrderEvidence | null;
  loading: boolean;
  error: string;
}

export function useReleaseOrderEvidence(projectId: string, releaseOrderId: string) {
  const actorId = useAuthStore().user?.id || '';
  const teamId = useTeamStore().currentTeam?.id || '';
  const scope = scopedRequestIdentity(actorId, teamId, projectId, releaseOrderId);
  const { begin, isCurrent } = useScopedRequestGuard(scope);
  const [state, setState] = useState<EvidenceState>(() => loadingState(scope));

  const load = useCallback(async () => {
    const request = begin('evidence');
    if (!actorId || !teamId || !isCurrent(request)) return;
    setState(loadingState(scope));
    try {
      const result = await apiRequest<ReleaseOrderEvidence>(
        `GET:/projects/${encodeURIComponent(projectId)}/delivery/releases/${encodeURIComponent(releaseOrderId)}/evidence?take=50`,
      );
      if (!isCurrent(request)) return;
      if (!ownsReleaseOrderEvidence(result, projectId, releaseOrderId)) {
        setState(failedState(scope, 'Release evidence scope mismatch'));
        return;
      }
      setState({ scope, evidence: result, loading: false, error: '' });
    } catch (caught) {
      if (isCurrent(request)) setState(failedState(scope, message(caught)));
    }
  }, [actorId, begin, isCurrent, projectId, releaseOrderId, scope, teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  const ownsState = state.scope === scope;
  return {
    scope: ownsState ? scope : null,
    evidence: ownsState ? state.evidence : null,
    loading: !ownsState || state.loading,
    error: ownsState ? state.error : '',
    load,
  };
}

function loadingState(scope: string): EvidenceState {
  return { scope, evidence: null, loading: true, error: '' };
}

function failedState(scope: string, error: string): EvidenceState {
  return { scope, evidence: null, loading: false, error };
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export type ReleaseOrderEvidenceHook = ReturnType<typeof useReleaseOrderEvidence>;
