export interface UseRequestStateOptions<T> {
  data: T | null | undefined;
  loading?: boolean;
  error?: unknown;
  isEmpty?: (data: T | null | undefined) => boolean;
}

export interface RequestStateResult {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  errorMessage: string;
}

function defaultIsEmpty(data: unknown) {
  if (data === null || data === undefined) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === 'object') {
    const anyData = data as any;
    if (Array.isArray(anyData.items)) return anyData.items.length === 0;
    if (Array.isArray(anyData.data)) return anyData.data.length === 0;
  }
  return false;
}

function toErrorMessage(error: unknown) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function useRequestState<T>(options: UseRequestStateOptions<T>): RequestStateResult {
  const { data, loading = false, error, isEmpty } = options;

  const isLoading = Boolean(loading);
  const isError = Boolean(error);
  const emptyFn = isEmpty || defaultIsEmpty;
  const isEmptyValue = !isLoading && !isError && emptyFn(data);

  return {
    isLoading,
    isError,
    isEmpty: isEmptyValue,
    errorMessage: toErrorMessage(error),
  };
}
