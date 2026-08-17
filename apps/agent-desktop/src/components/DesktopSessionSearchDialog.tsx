import React, { useEffect, useMemo, useRef } from 'react';
import { Modal } from '@svton/ui';
import { DesktopSessionSearchCombobox } from './DesktopSessionSearchCombobox';
import { DesktopSessionSearchSelectionActions } from './DesktopSessionSearchSelectionActions';
import { useDesktopSessionSearchKeyboard } from './use-desktop-session-search-keyboard';
import { useDesktopSessionUnarchive } from './use-desktop-session-unarchive';
import type { DesktopSessionSearchProps } from './desktop-session-search.types';

export function DesktopSessionSearchDialog(props: DesktopSessionSearchProps) {
  const {
    open,
    results,
    activityBySessionId,
    managementBySessionId,
    managementActions,
    search,
    onSelect,
    onClose,
  } = props;
  const queryRef = useRef<HTMLInputElement>(null);
  const selection = useDesktopSessionSearchKeyboard({
    results,
    query: search.query,
    scope: search.scope,
    searching: search.searching,
    onActivate: onSelect,
  });
  const unarchive = useDesktopSessionUnarchive(managementActions, queryRef);
  const selected = useMemo(() => results.find(
    ({ session }) => session.id === selection.selectedId,
  ), [results, selection.selectedId]);
  const archived = selected?.session.archivedAt !== undefined;
  const management = selected
    ? managementBySessionId.get(selected.session.id) : undefined;
  const canUnarchive = archived && management?.commands.includes('unarchive');
  useEffect(() => { unarchive.clearError(); }, [
    selection.selectedId, search.query, search.scope, unarchive.clearError,
  ]);
  useEffect(() => {
    if (search.error) unarchive.clearError();
  }, [search.error, unarchive.clearError]);
  const failure = Boolean(search.error || unarchive.failedId);
  const status = failure ? '' : unarchive.pendingId ? '正在取消归档…'
    : search.searching ? '正在搜索…'
      : results.length === 0 ? (search.query ? '没有找到匹配的对话' : '暂无对话')
        : `${results.length} 个对话`;
  const statusVisuallyHidden = !status || (!search.searching && results.length === 0);
  const retry = () => {
    if (search.error) {
      search.retry();
      queryRef.current?.focus();
    }
    else if (unarchive.failedId) void unarchive.unarchive(unarchive.failedId);
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="搜索对话"
      width={520}
      centered={false}
      initialFocusRef={queryRef}
      className="overflow-hidden"
      bodyClassName="min-h-0 overflow-hidden p-0"
      testId="desktop-session-search-dialog"
    >
      <div data-desktop-session-search className="flex min-h-0 max-w-full flex-col overflow-hidden">
        <DesktopSessionSearchCombobox
          results={results}
          activityBySessionId={activityBySessionId}
          search={search}
          queryRef={queryRef}
          selectedId={selection.selectedId}
          onQueryKeyDown={selection.onKeyDown}
          onSelect={selection.selectId}
          onActivate={onSelect}
        />
        {canUnarchive && selected && (
          <DesktopSessionSearchSelectionActions
            title={selected.session.title || '新对话'}
            pending={unarchive.pendingId === selected.session.id}
            onUnarchive={() => { void unarchive.unarchive(selected.session.id); }}
          />
        )}
        {failure && (
          <div role="alert" className="flex min-h-11 items-center justify-between gap-3 border-t border-border px-3 py-2 text-sm text-status-error">
            <span>{search.error ? '搜索暂时不可用。' : '操作暂时不可用，请重试。'}</span>
            <button type="button" onClick={retry} className="min-h-9 rounded px-2 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">重试</button>
          </div>
        )}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={statusVisuallyHidden
            ? 'sr-only'
            : 'min-h-9 border-t border-border px-4 py-2 text-xs text-muted-foreground'}
        >
          {status}
        </div>
      </div>
    </Modal>
  );
}
