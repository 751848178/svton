'use client';
import { Select } from '@svton/ui';
import type { SourceRef } from '@/lib/source-contracts';

export function SourceRefFields({ value, onChange, disabled, prefix = 'source' }: { value: SourceRef; onChange: (value: SourceRef) => void; disabled?: boolean; prefix?: string }) {
  return <div className="source-ref-fields"><div className="select-field"><label htmlFor={`${prefix}-kind`}>引用类型</label><Select id={`${prefix}-kind`} value={value.kind} disabled={disabled} onChange={event => onChange({ kind: event.target.value as SourceRef['kind'], value: '' })} options={[{ value: 'branch', label: '分支' }, { value: 'tag', label: '标签' }, { value: 'commit', label: 'Commit' }]} /></div>
    <label htmlFor={`${prefix}-ref`}>{value.kind === 'branch' ? '分支名' : value.kind === 'tag' ? '标签名' : '完整提交 SHA'}<input id={`${prefix}-ref`} value={value.value} disabled={disabled} onChange={event => onChange({ ...value, value: event.target.value })} placeholder={value.kind === 'branch' ? '留空读取仓库默认分支' : value.kind === 'tag' ? 'v1.0.0' : '40 位提交 SHA'} autoComplete="off" /></label>
  </div>;
}
