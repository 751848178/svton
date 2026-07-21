import type { ToolResult } from '@svton/agent-core';
import type { ContentBlock } from './types';

export function readCsvFanoutBlock(result: ToolResult): ContentBlock | null {
  const parsed = readCsvFanoutRecord(result.metadata) ?? readOutputRecord(result.output);
  if (!parsed || parsed.totalRows === undefined) return null;
  return {
    type: 'csv_fanout',
    totalRows: readNumberValue(parsed.totalRows),
    succeeded: readNumberValue(parsed.succeeded ?? parsed.successCount),
    failed: readNumberValue(parsed.failed ?? parsed.failCount),
    rows: readCsvFanoutRows(parsed.rows ?? parsed.results),
  };
}

function readOutputRecord(output: string): Record<string, unknown> | null {
  try {
    return readCsvFanoutRecord(JSON.parse(output));
  } catch {
    return null;
  }
}

function readCsvFanoutRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readCsvFanoutRows(value: unknown): Array<{
  rowIndex: number;
  status: string;
  rowData: Record<string, string>;
  summary?: string;
}> {
  if (!Array.isArray(value)) return [];
  return value.map((row, index) => {
    const record = row && typeof row === 'object' ? row as Record<string, unknown> : {};
    return {
      rowIndex: readNumberValue(record.rowIndex, index + 1),
      status: readRowStatus(record),
      rowData: readRowData(record.rowData),
      summary: readRowSummary(record),
    };
  });
}

function readRowStatus(record: Record<string, unknown>): string {
  if (typeof record.status === 'string') return record.status;
  if (typeof record.success === 'boolean') return record.success ? 'success' : 'failed';
  return 'pending';
}

function readRowSummary(record: Record<string, unknown>): string | undefined {
  if (typeof record.summary === 'string') return record.summary;
  return typeof record.error === 'string' ? record.error : undefined;
}

function readRowData(value: unknown): Record<string, string> {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(record).map(([key, raw]) => [key, String(raw ?? '')]));
}

function readNumberValue(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string' || value.trim().length === 0) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
