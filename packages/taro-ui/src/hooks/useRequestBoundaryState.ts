import { useRequestState } from '@svton/hooks';

export interface UseRequestBoundaryStateOptions<T> {
  data: T | null | undefined;
  loading?: boolean;
  error?: unknown;
  isEmpty?: (data: T | null | undefined) => boolean;
}

export function useRequestBoundaryState<T>(options: UseRequestBoundaryStateOptions<T>) {
  const { data, loading = false, error, isEmpty } = options;
  return useRequestState({ data, loading, error, isEmpty });
}
