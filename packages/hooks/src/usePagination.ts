import { useRef, useState } from 'react';
import { usePersistFn } from './usePersistFn';

import { useDeepCompareEffect } from './useDeepCompareEffect';

export type PaginationKeys = {
  pageKey?: string;
  pageSizeKey?: string;
};

export interface UsePaginationOptions<TItem, TParams extends Record<string, any>, TResult>
  extends PaginationKeys {
  initialParams?: TParams;
  initialPage?: number;
  pageSize?: number;
  getItems?: (result: TResult) => TItem[];
  getHasMore?: (result: TResult, items: TItem[], pageSize: number) => boolean;
  refreshDeps?: any[];
  auto?: boolean;
}

export interface UsePaginationReturn<TItem> {
  data: TItem[];
  loading: boolean;
  error: Error | null;
  page: number;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
}

function defaultGetItems(result: any) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (typeof result === 'object') {
    if (Array.isArray(result.items)) return result.items;
    if (Array.isArray(result.data)) return result.data;
    if (result.data && Array.isArray(result.data.items)) return result.data.items;
  }
  return [];
}

export function usePagination<TItem, TParams extends Record<string, any> = Record<string, any>, TResult = any>(
  fetcher: (params: TParams) => Promise<TResult>,
  options: UsePaginationOptions<TItem, TParams, TResult> = {},
): UsePaginationReturn<TItem> {
  const {
    initialParams,
    initialPage = 1,
    pageSize = 10,
    pageKey = 'page',
    pageSizeKey = 'pageSize',
    getItems = defaultGetItems,
    getHasMore,
    refreshDeps = [],
    auto = true,
  } = options;

  const [data, setData] = useState<TItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(true);

  const paramsRef = useRef(initialParams);
  paramsRef.current = initialParams;

  const loadingRef = useRef(false);

  const loadMore = usePersistFn(async () => {
    if (loadingRef.current || loading || !hasMore) return;

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const currentPage = page;
      const params = {
        ...(paramsRef.current || {}),
        [pageKey]: currentPage,
        [pageSizeKey]: pageSize,
      } as TParams;

      const result = await fetcher(params);
      const items = (getItems as any)(result) as TItem[];

      setData((prev) => [...prev, ...items]);
      setPage((p) => p + 1);

      if (getHasMore) {
        setHasMore(getHasMore(result, items, pageSize));
      } else {
        setHasMore(items.length >= pageSize);
      }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  });

  const reset = usePersistFn(() => {
    setData([]);
    setError(null);
    setLoading(false);
    setHasMore(true);
    setPage(initialPage);
  });

  const refresh = usePersistFn(async () => {
    reset();
    await loadMore();
  });

  useDeepCompareEffect(() => {
    if (!auto) return;
    refresh();
  }, [auto, refreshDeps, initialParams, initialPage, pageKey, pageSizeKey, pageSize]);

  return {
    data,
    loading,
    error,
    page,
    hasMore,
    loadMore,
    refresh,
    reset,
  };
}
