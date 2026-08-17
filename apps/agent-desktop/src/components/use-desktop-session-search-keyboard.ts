import { useCallback, useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { SessionSearchResult } from '@svton/agent-client';

interface SelectionState {
  context: string;
  id: string | null;
  index: number;
}

export function useDesktopSessionSearchKeyboard({
  results,
  query,
  scope,
  searching,
  onActivate,
}: {
  results: SessionSearchResult[];
  query: string;
  scope: 'active' | 'archived';
  searching: boolean;
  onActivate: (id: string) => void;
}) {
  const context = `${scope}\u0000${query}`;
  const [selection, setSelection] = useState<SelectionState>({ context, id: null, index: 0 });
  const selectedIndex = useMemo(() => {
    if (searching || selection.context !== context || !selection.id) return -1;
    return results.findIndex(({ session }) => session.id === selection.id);
  }, [context, results, searching, selection]);
  const selectedId = selectedIndex >= 0 ? results[selectedIndex].session.id : null;

  useEffect(() => {
    if (searching) return;
    setSelection((current) => settleSelection(current, context, results));
  }, [context, results, searching]);

  const selectIndex = useCallback((index: number) => {
    if (searching || results.length === 0) return;
    const bounded = Math.max(0, Math.min(index, results.length - 1));
    setSelection({ context, id: results[bounded].session.id, index: bounded });
  }, [context, results, searching]);
  const selectId = useCallback((id: string) => {
    const index = results.findIndex(({ session }) => session.id === id);
    if (index >= 0) selectIndex(index);
  }, [results, selectIndex]);
  const activateSelected = useCallback(() => {
    if (searching || selectedIndex < 0) return;
    const session = results[selectedIndex].session;
    if (session.archivedAt === undefined) onActivate(session.id);
  }, [onActivate, results, searching, selectedIndex]);
  const onKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      selectIndex(selectedIndex < 0
        ? (event.key === 'ArrowDown' ? 0 : results.length - 1)
        : selectedIndex + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      selectIndex(event.key === 'Home' ? 0 : results.length - 1);
    } else if (event.key === 'Enter' && selectedIndex >= 0) {
      event.preventDefault();
      activateSelected();
    }
  }, [activateSelected, results.length, selectIndex, selectedIndex]);

  return { selectedId, selectedIndex, selectId, onKeyDown };
}

function settleSelection(
  current: SelectionState,
  context: string,
  results: SessionSearchResult[],
): SelectionState {
  if (results.length === 0) return { context, id: null, index: 0 };
  if (current.context !== context) return { context, id: results[0].session.id, index: 0 };
  const retained = results.findIndex(({ session }) => session.id === current.id);
  const index = retained >= 0 ? retained : Math.min(current.index, results.length - 1);
  const id = results[index].session.id;
  return current.id === id && current.index === index ? current : { context, id, index };
}
