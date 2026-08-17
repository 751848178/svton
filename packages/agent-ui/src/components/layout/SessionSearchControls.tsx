import React, { type InputHTMLAttributes, type RefObject } from 'react';
import { useI18n } from '@svton/ui';
import type { SessionSearchModel } from './sidebar.types';

type QueryInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'aria-label' | 'onChange' | 'type' | 'value'
> & { 'aria-label'?: string };

export function SessionSearchControls({
  search,
  inputRef,
  inputProps,
  showError = true,
}: {
  search: SessionSearchModel;
  inputRef?: RefObject<HTMLInputElement | null>;
  inputProps?: QueryInputProps;
  showError?: boolean;
}) {
  const { translate: t } = useI18n();
  const { className: queryClassName = '', ...queryProps } = inputProps ?? {};
  return (
    <div className="space-y-2 px-2 pb-2" data-testid="session-search-controls">
      <div className="flex rounded-md border border-border p-0.5" role="group" aria-label={t('session.search.scopeLabel')}>
        {(['active', 'archived'] as const).map((scope) => (
          <button
            key={scope}
            type="button"
            aria-pressed={search.scope === scope}
            onClick={() => search.setScope(scope)}
            className={`min-h-9 flex-1 rounded px-2 py-1 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-lg:min-h-11 ${
              search.scope === scope ? 'bg-muted text-foreground' : 'text-muted-foreground'
            }`}
          >
            {t(scope === 'active' ? 'session.search.active' : 'session.search.archived')}
          </button>
        ))}
      </div>
      <input
        {...queryProps}
        ref={inputRef}
        type="search"
        value={search.query}
        onChange={(event) => search.setQuery(event.target.value)}
        placeholder={t('session.search.placeholder')}
        aria-label={inputProps?.['aria-label'] ?? t('session.search.placeholder')}
        className={`min-h-9 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring max-lg:min-h-11 ${queryClassName}`}
      />
      <label className="flex min-h-8 items-center gap-2 text-[11px] text-muted-foreground max-lg:min-h-11">
        <input
          type="checkbox"
          checked={search.includeContent}
          onChange={(event) => search.setIncludeContent(event.target.checked)}
        />
        {t('session.search.includeContent')}
      </label>
      {showError && search.error && (
        <div role="alert" className="flex items-center justify-between text-[11px] text-status-error">
          <span>{t('session.search.unavailable')}</span>
          <button type="button" onClick={search.retry} className="rounded px-2 py-1 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-lg:min-h-11">{t('action.retry')}</button>
        </div>
      )}
    </div>
  );
}
