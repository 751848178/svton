import React, { ReactNode } from 'react';
import { useRequestState } from '@svton/hooks';

import { EmptyState } from '../EmptyState';
import { LoadingState } from '../LoadingState';

export interface RequestBoundaryProps<T> {
  data: T | null | undefined;
  loading?: boolean;
  error?: unknown;
  isEmpty?: (data: T | null | undefined) => boolean;
  loadingFallback?: ReactNode;
  emptyFallback?: ReactNode;
  errorFallback?: ReactNode | ((message: string, error: unknown) => ReactNode);
  children: ReactNode | ((data: T) => ReactNode);
}

export function RequestBoundary<T>(props: RequestBoundaryProps<T>) {
  const {
    data,
    loading = false,
    error,
    isEmpty,
    loadingFallback,
    emptyFallback,
    errorFallback,
    children,
  } = props;

  const state = useRequestState({ data, loading, error, isEmpty });

  if (state.isLoading) {
    return <>{loadingFallback || <LoadingState />}</>;
  }

  if (state.isError) {
    if (typeof errorFallback === 'function') {
      return <>{errorFallback(state.errorMessage, error)}</>;
    }

    if (errorFallback) {
      return <>{errorFallback}</>;
    }

    return <div style={{ padding: 24, color: 'rgba(0,0,0,0.6)', fontSize: 14 }}>{state.errorMessage || 'Request failed'}</div>;
  }

  if (state.isEmpty) {
    return <>{emptyFallback || <EmptyState />}</>;
  }

  if (typeof children === 'function') {
    return <>{children(data as T)}</>;
  }

  return <>{children}</>;
}
