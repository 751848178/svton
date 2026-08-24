'use client';

import { useCallback, useDeferredValue, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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

/** REL-1：筛选状态写入 URL query 的参数名（relQuery/relStatus，避免与部署视图参数撞名）。 */
export const RELEASE_ORDER_QUERY_PARAM = 'relQuery';
export const RELEASE_ORDER_STATUS_PARAM = 'relStatus';

const RELEASE_ORDER_LIST_STATUSES: readonly ReleaseOrderListStatus[] = [
  'draft',
  'building',
  'staging',
  'awaiting_approval',
  'production',
  'succeeded',
  'failed',
  'withdrawn',
];

/** 从 URL 读取状态筛选；非法值按未筛选处理，避免任意输入注入端点。 */
export function readReleaseOrderStatusParam(
  value: string | null | undefined,
): ReleaseOrderListStatus | null {
  return RELEASE_ORDER_LIST_STATUSES.includes(value as ReleaseOrderListStatus)
    ? (value as ReleaseOrderListStatus)
    : null;
}

export function useReleaseOrders(projectId: string) {
  const { user } = useAuthStore();
  const { currentTeam } = useTeamStore();
  const actorId = user?.id ?? null;
  const teamId = currentTeam?.id ?? null;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialQuery = searchParams?.get(RELEASE_ORDER_QUERY_PARAM) ?? '';
  const initialStatus = readReleaseOrderStatusParam(searchParams?.get(RELEASE_ORDER_STATUS_PARAM));
  const [query, setQueryState] = useState(initialQuery);
  const [status, setStatusState] = useState<ReleaseOrderListStatus | null>(initialStatus);
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

  /**
   * REL-1：筛选写入 URL（replace 不追加历史），刷新/分享/深链往返后可恢复；其余参数原样保留。
   * 以 ref 合并最新筛选值，连续两次变更不会因闭包过期互相覆盖。
   */
  const filtersRef = useRef({ query: initialQuery, status: initialStatus });
  const syncFiltersToUrl = useCallback(
    (patch: { query?: string; status?: ReleaseOrderListStatus | null }) => {
      filtersRef.current = {
        query: patch.query !== undefined ? patch.query : filtersRef.current.query,
        status: patch.status !== undefined ? patch.status : filtersRef.current.status,
      };
      const next = new URLSearchParams(searchParams?.toString() ?? '');
      if (filtersRef.current.query.trim())
        next.set(RELEASE_ORDER_QUERY_PARAM, filtersRef.current.query);
      else next.delete(RELEASE_ORDER_QUERY_PARAM);
      if (filtersRef.current.status)
        next.set(RELEASE_ORDER_STATUS_PARAM, filtersRef.current.status);
      else next.delete(RELEASE_ORDER_STATUS_PARAM);
      const nextQuery = next.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setQuery = useCallback(
    (value: string) => {
      setQueryState(value);
      syncFiltersToUrl({ query: value });
    },
    [syncFiltersToUrl],
  );

  const setStatus = useCallback(
    (value: ReleaseOrderListStatus | null) => {
      setStatusState(value);
      syncFiltersToUrl({ status: value });
    },
    [syncFiltersToUrl],
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
    createError,
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
