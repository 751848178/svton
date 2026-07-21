export interface ParsedCsvFanout {
  headers: string[];
  rows: Record<string, string>[];
}

export const CSV_FANOUT_CONCURRENCY_ERROR =
  'Error: "concurrency" must be a positive integer.';

export function resolveCsvFanoutConcurrency(concurrency?: number): number {
  if (concurrency === undefined) return 4;
  if (
    typeof concurrency !== 'number' ||
    !Number.isFinite(concurrency) ||
    !Number.isInteger(concurrency) ||
    concurrency <= 0
  ) {
    throw new Error(CSV_FANOUT_CONCURRENCY_ERROR);
  }
  return concurrency;
}

export function parseCsvFanoutContent(content: string): ParsedCsvFanout {
  if (!content || !content.trim()) {
    return { headers: [], rows: [] };
  }

  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const records = parseCsvRecords(normalized).filter(hasNonBlankCell);

  if (records.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = records[0].map((h) => h.trim());
  const rows = records.slice(1).map((record) => {
    const row: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      row[headers[c]] = record[c] ?? '';
    }
    return row;
  });

  return { headers, rows };
}

export function fillCsvFanoutTemplate(
  template: string,
  row: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([^{}\r\n]+?)\s*\}\}/g, (_match, key: string) => {
    const value = row[key.trim()];
    return value !== undefined ? value : '';
  });
}

function parseCsvRecords(content: string): string[][] {
  const records: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      currentRow.push(currentField);
      currentField = '';
    } else if (char === '\n') {
      currentRow.push(currentField);
      records.push(currentRow);
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    records.push(currentRow);
  }

  return records;
}

function hasNonBlankCell(record: string[]): boolean {
  return record.some((cell) => cell.trim().length > 0);
}
