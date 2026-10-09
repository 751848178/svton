'use client';
import useSWR from 'swr';
import type { ApiName, ApiParams, ApiResponse } from '@svton/api-client';
import { request } from '@/lib/api';

export function useApi<K extends ApiName>(route: K | null, params: ApiParams<K>, interval: number | ((data: ApiResponse<K> | undefined) => number) = 0) {
  return useSWR<ApiResponse<K>>(
    route ? [route, params] : null,
    ([name, input]: [K, ApiParams<K>]) => request(name, input as never),
    { refreshInterval: interval, revalidateOnFocus: true, dedupingInterval: 700, errorRetryInterval: 3000 },
  );
}
