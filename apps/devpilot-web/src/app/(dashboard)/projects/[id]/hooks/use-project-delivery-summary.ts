import { useRef } from 'react';
import useSWR from 'swr';
import { DEFAULT_SWR_CONFIG } from '@/hooks/api/use-api';
import { apiRequest } from '@/lib/api-client';
import { useAuthStore, useTeamStore } from '@/store/hooks';
import type { ProjectDeliverySummary } from '../types/project-delivery-summary.types';

export function useProjectDeliverySummary(
  projectId: string,
  initialSummary?: ProjectDeliverySummary,
) {
  const { user } = useAuthStore();
  const { currentTeam } = useTeamStore();
  const actorId = user?.id ?? null;
  const teamId = currentTeam?.id ?? null;
  const scopeResolved = useRef(false);
  const wasResolved = scopeResolved.current;
  if (actorId && teamId) scopeResolved.current = true;
  const endpoint = `GET:/projects/${projectId}/delivery/summary`;
  const fallback = shouldUseInitialProjectDeliverySummary(
    projectId,
    actorId,
    teamId,
    initialSummary?.scope ?? null,
    wasResolved,
  )
    ? initialSummary
    : undefined;
  const query = useSWR<ProjectDeliverySummary>(
    buildProjectDeliverySummaryCacheKey(endpoint, projectId, actorId, teamId),
    () => apiRequest<ProjectDeliverySummary>(endpoint),
    { ...DEFAULT_SWR_CONFIG, fallbackData: fallback, keepPreviousData: false },
  );
  const summary = query.data ?? fallback;
  return {
    summary,
    loading: shouldShowProjectDeliverySummaryLoading(query.isLoading, Boolean(summary)),
    error: query.error ?? null,
    refresh: query.mutate,
  };
}

export function buildProjectDeliverySummaryCacheKey(
  endpoint: string,
  projectId: string,
  actorId: string | null,
  teamId: string | null,
) {
  return actorId && teamId && projectId ? ([actorId, teamId, projectId, endpoint] as const) : null;
}

export function shouldUseInitialProjectDeliverySummary(
  projectId: string,
  actorId: string | null,
  teamId: string | null,
  scope: ProjectDeliverySummary['scope'] | null,
  scopeWasResolved: boolean,
) {
  if (!scope || scope.projectId !== projectId) return false;
  if (actorId && actorId !== scope.actorId) return false;
  if (teamId && teamId !== scope.teamId) return false;
  if (actorId && teamId) return true;
  return !scopeWasResolved;
}

export function shouldShowProjectDeliverySummaryLoading(
  isLoading: boolean,
  hasRenderableSummary: boolean,
) {
  return isLoading && !hasRenderableSummary;
}
