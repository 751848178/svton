'use client';
import { useRef, useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import { Select } from '@svton/ui';
import { importEnvBytes, mergeImported, type VariableRow } from '@/lib/config-form';
import { ErrorMessage } from './primitives';

export function ConfigVariableEditor({ rows, onChange, disabled, prefix, onImporting }: { rows: VariableRow[]; onChange: (rows: VariableRow[]) => void; disabled?: boolean; prefix: string; onImporting?: (value: boolean) => void }) {
  const file = useRef<HTMLInputElement>(null);
  const importing = useRef(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const blocked = disabled || reading;
  const update = (index: number, patch: Partial<VariableRow>) => onChange(rows.map((row, position) => position === index ? { ...row, ...patch } : row));
  const read = async (input: File | undefined) => {
    if (!input || importing.current || disabled) return;
    importing.current = true; setReading(true); setError(null); onImporting?.(true);
    try { if (input.size > 1_048_576) throw new Error('导入文件不能超过 1 MiB。'); onChange(mergeImported(rows, importEnvBytes(await input.arrayBuffer()))); }
    catch (failure) { setError(failure); }
    finally { if (file.current) file.current.value = ''; importing.current = false; setReading(false); onImporting?.(false); }
  };
  return <div className="config-variables"><ErrorMessage error={error} />
    {rows.length > 0 ? <div className="table-wrap"><table className="config-variable-table"><thead><tr><th>变量</th><th>值</th><th>秘密</th><th>操作</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index} className={row.mode === 'delete' ? 'config-row-deleted' : ''}>
      <td data-label="变量"><input aria-label={`${prefix} 第 ${index + 1} 项变量名`} value={row.key} disabled={blocked || row.original} onChange={event => update(index, { key: event.target.value })} placeholder="VARIABLE_NAME" /></td>
      <td data-label="值"><input aria-label={`${prefix} ${row.key || '新变量'}的值`} type={row.secret ? 'password' : 'text'} autoComplete={row.secret ? 'new-password' : 'off'} disabled={blocked || row.mode === 'delete'} value={row.value ?? ''} placeholder={row.secret && row.hasValue && row.mode === 'keep' ? '已设置；留空保持原值' : '允许空字符串'} onChange={event => update(index, { mode: 'set', value: event.target.value })} /></td>
      <td data-label="秘密"><label className="config-secret-toggle"><input type="checkbox" aria-label={`${prefix} ${row.key || '新变量'}标为秘密`} checked={row.secret} disabled={blocked || row.mode === 'delete'} onChange={event => update(index, { secret: event.target.checked })} /><span className="visually-hidden">秘密变量</span></label></td>
      <td data-label="操作"><Select aria-label={`${prefix} ${row.key || '新变量'}的操作`} value={row.mode} disabled={blocked} onChange={event => update(index, { mode: event.target.value as VariableRow['mode'], ...(event.target.value === 'keep' ? { value: row.savedValue } : {}) })} options={[...(row.original ? [{ value: 'keep', label: '保留值' }] : []), { value: 'set', label: '设置值' }, { value: 'delete', label: row.original ? '删除' : '移除' }]} />{!row.original && row.mode === 'delete' && <button className="button ghost small" type="button" onClick={() => onChange(rows.filter((_, position) => position !== index))} disabled={blocked}>移除此行</button>}</td>
    </tr>)}</tbody></table></div> : <p className="subtle">尚未设置变量。</p>}
    <div className="config-variable-actions"><button type="button" className="button secondary small" disabled={blocked} onClick={() => onChange([...rows, { key: '', value: '', secret: false, hasValue: false, original: false, mode: 'set' }])}><Plus size={14} aria-hidden="true" />添加变量</button><button type="button" className="button ghost small" disabled={blocked} onClick={() => file.current?.click()}><Upload size={14} aria-hidden="true" />导入 .env</button><input ref={file} type="file" disabled={blocked} tabIndex={-1} accept=".env,.txt,text/plain" className="visually-hidden" aria-label={`${prefix} 导入环境变量文件`} onChange={event => void read(event.target.files?.[0])} /></div>
    {reading && <p className="subtle" role="status">正在读取环境变量文件…</p>}<p className="form-help">单行值；导入不展开 $ 变量，导入值默认标为秘密。保留值不提交新值；设置值允许明确保存空字符串。</p>
  </div>;
}
