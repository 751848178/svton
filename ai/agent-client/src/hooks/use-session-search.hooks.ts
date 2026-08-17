import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionService } from '../service/session.service';
import type { SessionInfo } from '../service/session.types';
import type { SessionScope } from '../service/session-management-selectors';
import type { SessionSearchResult } from '../service/session-search.types';

export interface SessionSearchController {
  query: string;
  scope: SessionScope;
  includeContent: boolean;
  results: SessionSearchResult[];
  searching: boolean;
  error: 'unavailable' | null;
  setQuery: (query: string) => void;
  setScope: (scope: SessionScope) => void;
  setIncludeContent: (include: boolean) => void;
  retry: () => void;
}

export function useSessionSearch(
  sessionService: SessionService,
  sessions: SessionInfo[],
): SessionSearchController {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SessionScope>('active');
  const [includeContent, setIncludeContent] = useState(false);
  const [results, setResults] = useState<SessionSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<'unavailable' | null>(null);
  const [retryRevision, setRetryRevision] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    setSearching(true);
    setError(null);
    void sessionService.search(query, { scope, includeContent }).then((next) => {
      if (generation.current === current) setResults(next);
    }).catch(() => {
      if (generation.current !== current) return;
      setResults([]);
      setError('unavailable');
    }).finally(() => {
      if (generation.current === current) setSearching(false);
    });
  }, [sessionService, sessions, query, scope, includeContent, retryRevision]);
  return {
    query, scope, includeContent, results, searching, error,
    setQuery: useCallback((value: string) => setQuery(value), []),
    setScope: useCallback((value: SessionScope) => setScope(value), []),
    setIncludeContent: useCallback((value: boolean) => setIncludeContent(value), []),
    retry: useCallback(() => setRetryRevision((value) => value + 1), []),
  };
}
