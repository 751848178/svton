/**
 * Mobile 端 useAPI Hook
 * 适配 Taro 的 React Hook
 * 
 * 类型定义通过 {{ORG_NAME}}/types 扩展 @svton/api-client 的全局类型
 */

import { useDidShow } from '@tarojs/taro';
import { useState, useEffect, useRef } from 'react';
import { usePersistFn } from '@svton/hooks';
import type { ApiName, ApiParams, ApiResponse } from '@svton/api-client';
import { apiAsync } from '../services/api';
// 引入类型定义以启用模块增强
import '{{ORG_NAME}}/types';

/**
 * useAPI Hook 配置
 */
interface UseAPIConfig {
  /**
   * 是否立即加载
   */
  immediate?: boolean;
  /**
   * 页面显示时是否重新加载
   */
  refreshOnShow?: boolean;
  /**
   * 成功回调
   */
  onSuccess?: (data: any) => void;
  /**
   * 错误回调
   */
  onError?: (error: Error) => void;
}

/**
 * useAPI 返回类型
 */
interface UseAPIReturn<K extends ApiName> {
  data: ApiResponse<K> | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useAPI<K extends ApiName>(
  apiName: K,
  params?: ApiParams<K>,
  config: UseAPIConfig = {},
): UseAPIReturn<K> {
  const { immediate = true, refreshOnShow = false, onSuccess, onError } = config;

  const [data, setData] = useState<ApiResponse<K> | null>(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const fetchData = usePersistFn(async () => {
    if (!mountedRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const result = (
        params !== undefined
          ? await (apiAsync as any)(apiName, params)
          : await (apiAsync as any)(apiName)
      ) as ApiResponse<K>;

      if (mountedRef.current) {
        setData(result);
        onSuccess?.(result);
      }
    } catch (err: unknown) {
      if (mountedRef.current) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  });

  useEffect(() => {
    if (immediate || params !== undefined) {
      fetchData();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [apiName, JSON.stringify(params), fetchData, immediate, params]);

  useDidShow(() => {
    if (refreshOnShow && data) {
      fetchData();
    }
  });

  return {
    data,
    loading,
    error,
    refresh: fetchData,
  };
}

interface UseMutationReturn<K extends ApiName> {
  trigger: (params?: ApiParams<K>) => Promise<ApiResponse<K>>;
  loading: boolean;
  error: Error | null;
  data: ApiResponse<K> | null;
  reset: () => void;
}

export function useMutation<K extends ApiName>(apiName: K): UseMutationReturn<K> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<ApiResponse<K> | null>(null);

  const trigger = async (params?: ApiParams<K>): Promise<ApiResponse<K>> => {
    setLoading(true);
    setError(null);

    try {
      const result = (
        params !== undefined
          ? await (apiAsync as any)(apiName, params)
          : await (apiAsync as any)(apiName)
      ) as ApiResponse<K>;
      setData(result);
      return result;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setLoading(false);
    setError(null);
    setData(null);
  };

  return {
    trigger,
    loading,
    error,
    data,
    reset,
  };
}

 type ExtractItemType<T> = T extends { items: (infer Item)[] }
  ? Item
  : T extends { data: (infer Item)[] }
    ? Item
    : T extends Array<infer Item>
      ? Item
      : unknown;

 type PaginationParams<T> = T extends void
  ? { pageSize?: number }
  : Omit<T, 'page'> & { pageSize?: number };

 interface UsePaginationReturn<TItem> {
  data: TItem[];
  loading: boolean;
  error: Error | null;
  page: number;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
 }

 export function usePagination<K extends ApiName>(
  apiName: K,
  initialParams?: PaginationParams<ApiParams<K>>,
 ): UsePaginationReturn<ExtractItemType<ApiResponse<K>>> {
  type ItemType = ExtractItemType<ApiResponse<K>>;

  const [data, setData] = useState<ItemType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = initialParams?.pageSize || 10;

  const paramsRef = useRef(initialParams);
  paramsRef.current = initialParams;

  const isFirstRenderRef = useRef(true);
  const isRefreshingRef = useRef(false);

  const loadMore = usePersistFn(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    setError(null);

    try {
      const currentPage = isRefreshingRef.current ? 1 : page;

      const paginationParams = {
        ...(paramsRef.current || {}),
        page: currentPage,
        pageSize,
      };

      const result = await (apiAsync as any)(apiName, paginationParams);

      let newItems: ItemType[] = [];
      if (result && typeof result === 'object') {
        if ('items' in result && Array.isArray((result as any).items)) {
          newItems = (result as any).items as ItemType[];
        } else if ('data' in result && Array.isArray((result as any).data)) {
          newItems = (result as any).data as ItemType[];
        } else if ('items' in (result as any)?.data && Array.isArray((result as any).data?.items)) {
          newItems = (result as any).data.items as ItemType[];
        } else if (Array.isArray(result)) {
          newItems = result as ItemType[];
        }
      }

      if (isRefreshingRef.current) {
        setData(newItems);
        setPage(2);
        isRefreshingRef.current = false;
      } else {
        setData((prev: ItemType[]) => [...prev, ...newItems]);
        setPage((p: number) => p + 1);
      }

      if (newItems.length < pageSize) {
        setHasMore(false);
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
    } finally {
      setLoading(false);
    }
  });

  const refresh = usePersistFn(async () => {
    isRefreshingRef.current = true;
    setData([]);
    setHasMore(true);
    await loadMore();
  });

  useEffect(() => {
    loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }

    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialParams)]);

  return {
    data,
    loading,
    error,
    page,
    hasMore,
    loadMore,
    refresh,
  };
 }
