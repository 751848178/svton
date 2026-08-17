import React, { useState } from 'react';
import { ChevronIcon, SearchIcon, cn, useI18n } from '@svton/ui';

export interface SearchResultEntry {
  title: string;
  url: string;
  snippet?: string;
}

interface WebSearchBlockViewProps {
  query: string;
  results: SearchResultEntry[];
  className?: string;
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

/**
 * Inline web search block — shows query + result cards.
 */
export const WebSearchBlockView: React.FC<WebSearchBlockViewProps> = ({ query, results, className }) => {
  const { translate: t } = useI18n();
  // Default collapsed to a single-line summary.
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn('my-1 overflow-hidden rounded-lg border border-border bg-card', className)}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-accent"
        aria-expanded={expanded}
      >
        <SearchIcon size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="flex-1 truncate text-[11px] text-foreground">{query}</span>
        <span className="shrink-0 text-[10px] text-muted-foreground">{results.length} {t('search.results')}</span>
        <ChevronIcon size={14} className={cn('shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-90')} aria-hidden="true" />
      </button>

      {/* Results */}
      {expanded && results.length > 0 && (
        <div className="divide-y divide-border border-t border-border">
          {results.map((result, i) => (
            <div key={i} className="px-3 py-2 transition-colors hover:bg-accent">
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-[12px] text-status-info hover:underline"
              >
                {result.title}
              </a>
              <span className="block truncate text-[10px] text-muted-foreground">{domainFromUrl(result.url)}</span>
              {result.snippet && (
                <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{result.snippet}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
