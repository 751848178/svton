import { usePersistFn } from '@svton/hooks';
import { useReachBottom } from './useReachBottom';

export interface UseLoadMoreOnReachBottomOptions {
  hasMore: boolean;
  loading: boolean;
  loadMore: () => void | Promise<void>;
}

export function useLoadMoreOnReachBottom(options: UseLoadMoreOnReachBottomOptions) {
  const { hasMore, loading, loadMore } = options;

  const loadMorePersist = usePersistFn(loadMore);

  useReachBottom(async () => {
    if (loading || !hasMore) return;
    await loadMorePersist();
  });
}
