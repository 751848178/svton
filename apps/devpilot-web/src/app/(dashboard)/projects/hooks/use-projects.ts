import { useDeferredValue, useMemo, useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { useQueryLoose } from '@/hooks/api/use-api';
import type {
  ProjectConfigurationFilter,
  ProjectDirectoryResponse,
  ProjectRuntimeFilter,
} from '../types';

const BASE_QUERY = 'GET:/project-directory?take=100';

export function useProjects(initialDirectory?: ProjectDirectoryResponse) {
  const [search, setSearch] = useState('');
  const [runtimeFilter, setRuntimeFilter] = useState<ProjectRuntimeFilter>('all');
  const [configurationFilter, setConfigurationFilter] = useState<ProjectConfigurationFilter>('all');
  const deferredSearch = useDeferredValue(search.trim());
  const queryKey = useMemo(
    () => buildDirectoryQuery(deferredSearch, runtimeFilter, configurationFilter),
    [configurationFilter, deferredSearch, runtimeFilter],
  );
  const directory = useQueryLoose<ProjectDirectoryResponse>(queryKey, {
    fallback: queryKey === BASE_QUERY ? initialDirectory : undefined,
    keepPreviousData: true,
  });

  const refresh = usePersistFn(() => {
    void directory.mutate();
  });

  return {
    items: directory.data?.items ?? [],
    total: directory.data?.total ?? 0,
    summary: initialDirectory?.summary ?? directory.data?.summary,
    search,
    setSearch,
    runtimeFilter,
    setRuntimeFilter,
    configurationFilter,
    setConfigurationFilter,
    loading: directory.isLoading,
    validating: directory.isValidating,
    error: directory.error ?? null,
    refresh,
  };
}

export function buildDirectoryQuery(
  search: string,
  runtime: ProjectRuntimeFilter,
  configuration: ProjectConfigurationFilter,
) {
  const query = new URLSearchParams({ take: '100' });
  if (search) query.set('search', search);
  if (runtime !== 'all') query.set('runtimeStatus', runtime);
  if (configuration !== 'all') {
    query.set('configurationStatus', configuration);
  }
  return `GET:/project-directory?${query.toString()}`;
}
