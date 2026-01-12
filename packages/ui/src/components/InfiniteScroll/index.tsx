import React, { useEffect, useRef, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { LoadingState } from '../LoadingState';

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

export function InfiniteScroll(props: InfiniteScrollProps) {
  const { hasMore, loading = false, onLoadMore, threshold = 100, loader, endMessage, children, className } = props;

  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(loading);
  const hasMoreRef = useRef(hasMore);

  loadingRef.current = loading;
  hasMoreRef.current = hasMore;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMoreRef.current && !loadingRef.current) {
          onLoadMore();
        }
      },
      { rootMargin: `${threshold}px` }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [onLoadMore, threshold]);

  return (
    <div className={className}>
      {children}
      <div ref={sentinelRef} className="h-px" />
      {loading && (loader || <LoadingState text="Loading more..." className="p-4" />)}
      {!hasMore && !loading && endMessage}
    </div>
  );
}
