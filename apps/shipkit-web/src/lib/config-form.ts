import type { VariablePatch, VariableView } from './config-contracts';

export interface VariableRow { key: string; secret: boolean; hasValue: boolean; value?: string; savedValue?: string; original: boolean; mode: 'keep' | 'set' | 'delete' }
export const variableRows = (variables: VariableView[] = []): VariableRow[] => variables.map(variable => ({ ...variable, value: variable.secret ? undefined : variable.value, savedValue: variable.secret ? undefined : variable.value, original: true, mode: 'keep' }));
export function variablePatches(rows: VariableRow[]): VariablePatch[] {
  const seen = new Set<string>();
  return rows.filter(row => row.original || row.mode !== 'delete').map(row => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(row.key)) throw new Error('变量名只能使用字母、数字和下划线，且不能以数字开头。');
    if (seen.has(row.key)) throw new Error(`变量 ${row.key} 重复，请保留一项。`);
    seen.add(row.key);
    if (row.mode === 'delete') return { key: row.key, delete: true };
    if (row.mode === 'keep') return { key: row.key, secret: row.secret };
    const value = row.value ?? '';
    if (/[\r\n\0]/.test(value)) throw new Error(`变量 ${row.key} 仅支持单行值。`);
    return { key: row.key, value, secret: row.secret };
  });
}
export function importEnv(text: string): VariableRow[] {
  const rows: VariableRow[] = [];
  for (const [index, line] of text.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line.trimStart());
    if (!match) throw new Error(`第 ${index + 1} 行不是单行 KEY=value。`);
    const raw = match[2].trimStart();
    let value: string;
    if (raw.startsWith('"') || raw.startsWith("'")) {
      const quote = raw[0];
      const quoted = quote === '"' ? /^"(?:[^"\\]|\\.)*"/.exec(raw)?.[0] : /^'[^']*'/.exec(raw)?.[0];
      if (!quoted || !/^(?:\s*#.*)?$/.test(raw.slice(quoted.length))) throw new Error(`第 ${index + 1} 行的引号或注释无效。`);
      try { value = quote === '"' ? JSON.parse(quoted) : quoted.slice(1, -1); } catch { throw new Error(`第 ${index + 1} 行包含不支持的转义，请直接在表格输入值。`); }
    } else value = raw.replace(/\s+#.*$/, '').trimEnd();
    rows.push({ key: match[1], value, secret: true, hasValue: true, original: false, mode: 'set' });
  }
  variablePatches(rows);
  return rows;
}
export function importEnvBytes(bytes: ArrayBuffer): VariableRow[] {
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new Error('导入文件必须为 UTF-8 文本。'); }
  return importEnv(text);
}
export function mergeImported(rows: VariableRow[], imported: VariableRow[]): VariableRow[] {
  const merged = rows.map(row => { const replacement = imported.find(item => item.key === row.key); return replacement ? { ...replacement, original: row.original, savedValue: row.savedValue } : row; });
  return [...merged, ...imported.filter(item => !rows.some(row => row.key === item.key))];
}
export function nextConfigVersion(versions: Array<{ version: string }>): string {
  const sorted = versions.map(item => item.version.split('.').map(Number)).filter(parts => parts.length === 3 && parts.every(Number.isFinite)).sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2]);
  const latest = sorted[0]; return latest ? `${latest[0]}.${latest[1]}.${latest[2] + 1}` : '0.0.1';
}
