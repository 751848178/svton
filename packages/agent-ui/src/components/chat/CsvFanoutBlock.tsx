import React, { useState } from 'react';
import { ChevronIcon, cn, useI18n, type TranslationKey } from '@svton/ui';
import { TimelineStatusIcon, type TranscriptStatus } from '../timeline/TimelineStatusIcon';

export interface CsvFanoutRow {
  rowIndex: number;
  status: 'pending' | 'running' | 'success' | 'failed';
  rowData: Record<string, string>;
  summary?: string;
}

export interface CsvFanoutBlockProps {
  rows: CsvFanoutRow[];
  totalRows: number;
  className?: string;
}

const STATUS_INDICATOR: Record<CsvFanoutRow['status'], { status: TranscriptStatus; labelKey: TranslationKey }> = {
  pending: { status: 'pending', labelKey: 'status.pending' },
  running: { status: 'running', labelKey: 'status.running' },
  success: { status: 'success', labelKey: 'status.success' },
  failed: { status: 'failed', labelKey: 'status.failed' },
};

/**
 * Displays CSV fan-out results as a table with status indicators
 * and a progress bar.
 */
export const CsvFanoutBlock: React.FC<CsvFanoutBlockProps> = ({
  rows,
  totalRows,
  className,
}) => {
  const { translate: t } = useI18n();
  const [expanded, setExpanded] = useState(true);

  const completed = rows.filter((r) => r.status === 'success' || r.status === 'failed').length;
  const failed = rows.filter((r) => r.status === 'failed').length;
  const running = rows.filter((r) => r.status === 'running').length;
  const pct = totalRows > 0 ? Math.round((completed / totalRows) * 100) : 0;

  // Collect column keys from all rows
  const allKeys = React.useMemo(() => {
    const keySet = new Set<string>();
    rows.forEach((r) => Object.keys(r.rowData).forEach((k) => keySet.add(k)));
    return Array.from(keySet);
  }, [rows]);

  return (
    <div className={cn('svton-csv-fanout overflow-hidden rounded-lg border border-border bg-card', className)}>
      {/* Header */}
      <button
        className="flex min-h-11 w-full items-center gap-2 px-3 py-2 transition-colors hover:bg-accent"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className="text-xs font-semibold text-foreground">{t('csv.title')}</span>
        <span className="text-[10px] text-muted-foreground">
          {completed}/{totalRows}
        </span>
        {failed > 0 && (
          <span className="rounded bg-destructive/10 px-1.5 text-[10px] text-destructive">
            {failed} {t('status.failed')}
          </span>
        )}
        {running > 0 && (
          <span className="rounded bg-status-info/10 px-1.5 text-[10px] text-status-info">
            {running} {t('status.running')}
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">{pct}%</span>
        <ChevronIcon size={14} className={cn('text-muted-foreground transition-transform', expanded && 'rotate-90')} aria-hidden="true" />
      </button>

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className={cn('h-full transition-all duration-300 motion-reduce:transition-none', failed > 0 ? 'bg-status-warning' : 'bg-status-success')}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Table */}
      {expanded && (
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr className="border-b border-border">
                <th className="w-8 px-2 py-1.5 text-left text-[10px] font-medium text-muted-foreground">#</th>
                <th className="w-20 px-2 py-1.5 text-left text-[10px] font-medium text-muted-foreground">{t('csv.status')}</th>
                {allKeys.map((key) => (
                  <th key={key} className="whitespace-nowrap px-2 py-1.5 text-left text-[10px] font-medium text-muted-foreground">
                    {key}
                  </th>
                ))}
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-muted-foreground">{t('csv.summary')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const indicator = STATUS_INDICATOR[row.status];
                return (
                  <tr
                    key={row.rowIndex}
                    className="border-b border-border hover:bg-accent"
                  >
                    <td className="px-2 py-1 text-[10px] text-muted-foreground">{row.rowIndex}</td>
                    <td className="px-2 py-1">
                      <span className={`svton-csv-status svton-csv-status-${row.status} flex items-center gap-1`}>
                        <TimelineStatusIcon status={indicator.status} />
                        <span className="text-[10px] text-foreground">{t(indicator.labelKey)}</span>
                      </span>
                    </td>
                    {allKeys.map((key) => (
                      <td key={key} className="max-w-[200px] truncate px-2 py-1 text-foreground" title={row.rowData[key] ?? ''}>
                        {row.rowData[key] ?? ''}
                      </td>
                    ))}
                    <td className="max-w-[300px] truncate px-2 py-1 text-muted-foreground" title={row.summary ?? ''}>
                      {row.summary ?? ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
