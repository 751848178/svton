import { useDeferredValue, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { usePersistFn } from '@svton/hooks';
import { DEFAULT_SWR_CONFIG } from '@/hooks/api/use-api';
import { apiRequest } from '@/lib/api-client';
import { useAuthStore, useTeamStore } from '@/store/hooks';
import type { ProjectDirectoryResponse, ProjectDirectoryStatusFilter } from '../types';

export const PROJECT_DIRECTORY_BASE_QUERY = 'GET:/project-directory?take=100';

export function useProjects(initialDirectory?: ProjectDirectoryResponse) {
  const { user } = useAuthStore();
  const { currentTeam } = useTeamStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectDirectoryStatusFilter>('all');
  const deferredSearch = useDeferredValue(search.trim());
  const queryKey = useMemo(
    () => buildDirectoryQuery(deferredSearch, statusFilter),
    [deferredSearch, statusFilter],
  );
  const userId = user?.id ?? null;
  const teamId = currentTeam?.id ?? null;
  const hasResolvedScope = useRef(false);
  const scopeWasResolved = hasResolvedScope.current;
  if (userId && teamId) hasResolvedScope.current = true;
  const scopedKey = buildDirectoryCacheKey(queryKey, userId, teamId);
  const fallbackDirectory = shouldUseInitialDirectory(
    queryKey,
    userId,
    teamId,
    initialDirectory?.scope ?? null,
    scopeWasResolved,
  )
    ? initialDirectory
    : undefined;
  const directory = useSWR<ProjectDirectoryResponse>(
    scopedKey,
    async () =>
      (await (apiRequest as (name: string) => Promise<ProjectDirectoryResponse>)(
        queryKey,
      )) as ProjectDirectoryResponse,
    {
      ...DEFAULT_SWR_CONFIG,
      fallbackData: fallbackDirectory,
      keepPreviousData: false,
    },
  );
  const visibleDirectory = directory.data ?? fallbackDirectory;

  const refresh = usePersistFn(() => void directory.mutate());
  const resetFilters = usePersistFn(() => {
    setSearch('');
    setStatusFilter('all');
  });

  return {
    items: visibleDirectory?.items ?? [],
    total: visibleDirectory?.total ?? 0,
    summary: visibleDirectory?.summary,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    filtered: Boolean(search.trim()) || statusFilter !== 'all',
    resetFilters,
    loading: shouldShowDirectoryLoading(directory.isLoading, Boolean(visibleDirectory)),
    validating: directory.isValidating,
    error: directory.error ?? null,
    refresh,
  };
}

export function shouldShowDirectoryLoading(isLoading: boolean, hasRenderableDirectory: boolean) {
  return isLoading && !hasRenderableDirectory;
}

export function buildDirectoryCacheKey(
  query: string,
  userId: string | null,
  teamId: string | null,
) {
  return userId && teamId ? ([userId, teamId, query] as const) : null;
}

export function shouldUseInitialDirectory(
  query: string,
  userId: string | null,
  teamId: string | null,
  initialScope: { actorId: string; teamId: string } | null,
  scopeWasResolved: boolean,
) {
  if (query !== PROJECT_DIRECTORY_BASE_QUERY || !initialScope) return false;
  if (userId && userId !== initialScope.actorId) return false;
  if (teamId && teamId !== initialScope.teamId) return false;
  if (userId && teamId) return true;
  return !scopeWasResolved;
}

export function buildDirectoryQuery(search: string, status: ProjectDirectoryStatusFilter) {
  const query = new URLSearchParams({ take: '100' });
  if (search) query.set('query', search);
  if (status !== 'all') query.set('status', status);
  return `GET:/project-directory?${query.toString()}`;
}
