import React, { useState } from 'react';

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

const STATUS_INDICATOR: Record<CsvFanoutRow['status'], { icon: string; color: string; label: string }> = {
  pending: { icon: '○', color: 'text-gray-500', label: 'Pending' },
  running: { icon: '●', color: 'text-blue-400 animate-pulse', label: 'Running' },
  success: { icon: '✓', color: 'text-green-400', label: 'Success' },
  failed: { icon: '✗', color: 'text-red-400', label: 'Failed' },
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
    <div className={`svton-csv-fanout rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] overflow-hidden ${className ?? ''}`}>
      {/* Header */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#222] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-xs font-semibold text-gray-300">CSV Fan-out</span>
        <span className="text-[10px] text-gray-500">
          {completed}/{totalRows}
        </span>
        {failed > 0 && (
          <span className="text-[10px] text-red-400 bg-red-950/50 px-1.5 rounded">
            {failed} failed
          </span>
        )}
        {running > 0 && (
          <span className="text-[10px] text-blue-400 bg-blue-950/50 px-1.5 rounded">
            {running} running
          </span>
        )}
        <span className="text-[10px] text-gray-500 ml-auto">{pct}%</span>
        <span className="text-gray-500 text-xs">{expanded ? '▾' : '▸'}</span>
      </button>

      {/* Progress bar */}
      <div className="h-1 bg-[#222]">
        <div
          className={`h-full transition-all duration-300 ${failed > 0 ? 'bg-orange-400' : 'bg-green-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Table */}
      {expanded && (
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#1c1c1c] z-10">
              <tr className="border-b border-[#2a2a2a]">
                <th className="px-2 py-1.5 text-left text-[10px] text-gray-500 font-medium w-8">#</th>
                <th className="px-2 py-1.5 text-left text-[10px] text-gray-500 font-medium w-20">Status</th>
                {allKeys.map((key) => (
                  <th key={key} className="px-2 py-1.5 text-left text-[10px] text-gray-500 font-medium whitespace-nowrap">
                    {key}
                  </th>
                ))}
                <th className="px-2 py-1.5 text-left text-[10px] text-gray-500 font-medium">Summary</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const indicator = STATUS_INDICATOR[row.status];
                return (
                  <tr
                    key={row.rowIndex}
                    className="border-b border-[#222] hover:bg-[#1e1e1e]"
                  >
                    <td className="px-2 py-1 text-gray-600 text-[10px]">{row.rowIndex}</td>
                    <td className="px-2 py-1">
                      <span className={`svton-csv-status svton-csv-status-${row.status} flex items-center gap-1 ${indicator.color}`}>
                        <span className="text-[10px]">{indicator.icon}</span>
                        <span className="text-[10px]">{indicator.label}</span>
                      </span>
                    </td>
                    {allKeys.map((key) => (
                      <td key={key} className="px-2 py-1 text-gray-400 max-w-[200px] truncate" title={row.rowData[key] ?? ''}>
                        {row.rowData[key] ?? ''}
                      </td>
                    ))}
                    <td className="px-2 py-1 text-gray-500 max-w-[300px] truncate" title={row.summary ?? ''}>
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
