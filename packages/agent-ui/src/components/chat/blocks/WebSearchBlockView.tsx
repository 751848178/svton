import React, { useState } from 'react';
import { cn } from '@svton/ui';

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
  // Codex-style: default collapsed to a single-line summary.
  // The summary shows the query + result count; expand to see full results.
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn('rounded-lg border border-[#383838] bg-[#2a2a2a] overflow-hidden my-1', className)}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#2a2a2a] transition-colors"
      >
        <span className="text-xs flex-shrink-0">🔍</span>
        <span className="text-[11px] text-gray-300 truncate flex-1">{query}</span>
        <span className="text-[10px] text-gray-600 flex-shrink-0">{results.length} results</span>
        <span className="text-gray-500 text-[10px] flex-shrink-0">{expanded ? '▾' : '▸'}</span>
      </button>

      {/* Results */}
      {expanded && results.length > 0 && (
        <div className="border-t border-[#3a3a3a] divide-y divide-[#252525]">
          {results.map((result, i) => (
            <div key={i} className="px-3 py-2 hover:bg-[#252525] transition-colors">
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] text-blue-400 hover:text-blue-300 hover:underline block truncate"
              >
                {result.title}
              </a>
              <span className="text-[10px] text-gray-600 block truncate">{domainFromUrl(result.url)}</span>
              {result.snippet && (
                <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{result.snippet}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
