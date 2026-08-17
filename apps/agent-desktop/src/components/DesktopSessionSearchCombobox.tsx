import React, { useEffect, useId } from 'react';
import type { KeyboardEvent, RefObject } from 'react';
import { SessionSearchControls, type SessionSearchModel } from '@svton/agent-ui';
import type { SessionActivityViewModel, SessionSearchResult } from '@svton/agent-client';
import { DesktopSessionSearchOption } from './DesktopSessionSearchOption';

export function DesktopSessionSearchCombobox({
  results,
  activityBySessionId,
  search,
  queryRef,
  selectedId,
  onQueryKeyDown,
  onSelect,
  onActivate,
}: {
  results: SessionSearchResult[];
  activityBySessionId: ReadonlyMap<string, SessionActivityViewModel>;
  search: SessionSearchModel;
  queryRef: RefObject<HTMLInputElement | null>;
  selectedId: string | null;
  onQueryKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onSelect: (id: string) => void;
  onActivate: (id: string) => void;
}) {
  const id = useId();
  const listboxId = `${id}-desktop-session-search-results`;
  const selectedIndex = results.findIndex(({ session }) => session.id === selectedId);
  const activeOptionId = selectedIndex >= 0 && !search.searching
    ? optionId(listboxId, results[selectedIndex].session.id) : undefined;
  useEffect(() => {
    if (!activeOptionId) return;
    document.getElementById(activeOptionId)?.scrollIntoView({ block: 'nearest' });
  }, [activeOptionId]);
  const empty = !search.searching && !search.error && results.length === 0;
  return (
    <div className="flex min-h-0 flex-col">
      <div className="border-b border-border pt-3">
        <SessionSearchControls
          search={search}
          inputRef={queryRef}
          showError={false}
          inputProps={{
            role: 'combobox',
            'aria-autocomplete': 'list',
            'aria-expanded': true,
            'aria-controls': listboxId,
            'aria-activedescendant': activeOptionId,
            onKeyDown: onQueryKeyDown,
          }}
        />
      </div>
      <div
        id={listboxId}
        role="listbox"
        aria-label="搜索结果"
        aria-busy={search.searching}
        className="max-h-[52vh] min-h-0 overflow-y-auto overflow-x-hidden py-1"
      >
        {results.map((result) => (
          <DesktopSessionSearchOption
            key={result.session.id}
            result={result}
            optionId={optionId(listboxId, result.session.id)}
            selected={result.session.id === selectedId}
            archived={result.session.archivedAt !== undefined}
            searching={search.searching}
            activity={activityBySessionId.get(result.session.id)}
            onSelect={onSelect}
            onActivate={onActivate}
          />
        ))}
      </div>
      {empty && (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          {search.query ? '没有找到匹配的对话' : '暂无对话'}
        </div>
      )}
    </div>
  );
}

function optionId(listboxId: string, sessionId: string): string {
  let token = '';
  for (let index = 0; index < sessionId.length; index += 1) {
    token += sessionId.charCodeAt(index).toString(16).padStart(4, '0');
  }
  return `${listboxId}-option-${token || 'empty'}`;
}
