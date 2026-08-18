'use client';

import { useCallback, useDeferredValue, useState } from 'react';
import useSWR from 'swr';
import type { ScopedMutator } from 'swr';
import { DEFAULT_SWR_CONFIG } from '@/hooks/api/use-api';
import { apiRequest } from '@/lib/api-client';
import { useAuthStore, useTeamStore } from '@/store/hooks';
import type {
  ReleaseOrderListResponse,
  ReleaseOrderListStatus,
} from '../types/release-order-list.types';
import type { CreateReleaseOrderInput, ReleaseOrderDetail } from '../types/release-order.types';

const DEFAULT_TAKE = 50;

export function useReleaseOrders(projectId: string) {
  const { user } = useAuthStore();
  const { currentTeam } = useTeamStore();
  const actorId = user?.id ?? null;
  const teamId = currentTeam?.id ?? null;
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<ReleaseOrderListStatus | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const deferredQuery = useDeferredValue(query.trim());
  const endpoint = buildReleaseOrderListEndpoint(projectId, {
    query: deferredQuery,
    status,
    take: DEFAULT_TAKE,
  });
  const list = useSWR<ReleaseOrderListResponse>(
    buildReleaseOrderListCacheKey(endpoint, projectId, actorId, teamId),
    () => apiRequest<ReleaseOrderListResponse>(endpoint),
    { ...DEFAULT_SWR_CONFIG, keepPreviousData: false },
  );

  const create = useCallback(
    async (input: CreateReleaseOrderInput) => {
      if (!projectId) return null;
      setCreating(true);
      setCreateError('');
      try {
        return await createReleaseOrderAndRefresh(projectId, input, list.mutate);
      } catch (caught) {
        setCreateError(errorMessage(caught));
        return null;
      } finally {
        setCreating(false);
      }
    },
    [list.mutate, projectId],
  );

  return {
    items: list.data?.items ?? [],
    total: list.data?.total ?? 0,
    query,
    status,
    setQuery,
    setStatus,
    loading: Boolean(projectId) && (!actorId || !teamId || list.isLoading),
    creating,
    error: createError || (list.error ? errorMessage(list.error) : ''),
    load: list.mutate,
    create,
  };
}

export function buildReleaseOrderListEndpoint(
  projectId: string,
  input: { query?: string; status?: ReleaseOrderListStatus | null; take: number },
) {
  const params = new URLSearchParams({ take: String(input.take) });
  const query = input.query?.trim();
  if (query) params.set('query', query);
  if (input.status) params.set('status', input.status);
  return `GET:/projects/${encodeURIComponent(projectId)}/delivery/releases?${params.toString()}`;
}

export function buildReleaseOrderListCacheKey(
  endpoint: string,
  projectId: string,
  actorId: string | null,
  teamId: string | null,
) {
  return actorId && teamId && projectId ? ([actorId, teamId, projectId, endpoint] as const) : null;
}

/** 发布单创建/回滚后失效发布单列表缓存（take=50 默认档），供进度链路复用。 */
export async function invalidateReleaseOrderListCache(
  mutate: ScopedMutator,
  scope: { projectId: string; actorId: string | null; teamId: string | null },
) {
  const endpoint = buildReleaseOrderListEndpoint(scope.projectId, { take: DEFAULT_TAKE });
  const key = buildReleaseOrderListCacheKey(endpoint, scope.projectId, scope.actorId, scope.teamId);
  if (key) await mutate(key, undefined, { revalidate: true });
}

export async function createReleaseOrderAndRefresh(
  projectId: string,
  input: CreateReleaseOrderInput,
  refresh: () => Promise<unknown>,
) {
  const created = await apiRequest<ReleaseOrderDetail>(
    `POST:/projects/${encodeURIComponent(projectId)}/delivery/releases`,
    input,
  );
  await refresh();
  return created;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export type ReleaseOrdersHook = ReturnType<typeof useReleaseOrders>;
