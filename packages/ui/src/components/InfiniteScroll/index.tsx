import React, { useEffect, useRef, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { LoadingState } from '../LoadingState';
import { useI18n } from '../../i18n';

export interface InfiniteScrollProps {
  hasMore: boolean;
  loading?: boolean;
  onLoadMore: () => void;
  threshold?: number;
  loader?: ReactNode;
  endMessage?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * InfiniteScroll 无限滚动
 *
 * 优先使用 IntersectionObserver 监听哨兵；环境无 IO 时降级为
 * window scroll 事件 + 哨兵 boundingRect 检测。加载态以 role=status 播报。
 */
export function InfiniteScroll(props: InfiniteScrollProps) {
  const { translate } = useI18n();
  const {
    hasMore,
    loading = false,
    onLoadMore,
    threshold = 100,
    loader,
    endMessage,
    children,
    className,
  } = props;

  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(loading);
  const hasMoreRef = useRef(hasMore);
  const thresholdRef = useRef(threshold);

  loadingRef.current = loading;
  hasMoreRef.current = hasMore;
  thresholdRef.current = threshold;

  const maybeLoad = () => {
    if (!hasMoreRef.current || loadingRef.current) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const rect = sentinel.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top - viewportHeight <= thresholdRef.current) onLoadMore();
  };

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry.isIntersecting && hasMoreRef.current && !loadingRef.current) {
            onLoadMore();
          }
        },
        { rootMargin: `${threshold}px` },
      );
      observer.observe(sentinel);
      return () => observer.disconnect();
    }

    window.addEventListener('scroll', maybeLoad, { passive: true });
    window.addEventListener('resize', maybeLoad, { passive: true });
    maybeLoad();
    return () => {
      window.removeEventListener('scroll', maybeLoad);
      window.removeEventListener('resize', maybeLoad);
    };
  }, [onLoadMore, threshold]);

  return (
    <div className={className}>
      {children}
      <div ref={sentinelRef} className="h-px" aria-hidden="true" />
      {loading && (
        <div role="status" aria-live="polite">
          {loader || <LoadingState text={translate('ui.loading')} className="p-4" />}
        </div>
      )}
      {!hasMore && !loading && endMessage}
    </div>
  );
}
