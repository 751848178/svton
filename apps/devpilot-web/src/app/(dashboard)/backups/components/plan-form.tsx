/**
 * 备份计划创建表单
 *
 * 单一职责：收集表单输入并提交创建。
 */

import { useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import type { ManagedResource, BackupPlanInput } from '../types';
import { providerLabels, kindLabels } from '../constants';

interface PlanFormProps {
  resources: ManagedResource[];
  creating: boolean;
  onCreate: (input: BackupPlanInput) => void;
}

export function PlanForm({ resources, creating, onCreate }: PlanFormProps) {
  const [resourceId, setResourceId] = useState('');
  const [name, setName] = useState('');
  const [backupType, setBackupType] = useState('auto');
  const [destinationType, setDestinationType] = useState('local');
  const [retentionDays, setRetentionDays] = useState(7);

  const selected = resources.find((r) => r.id === resourceId);

  const handleSubmit = usePersistFn(() => {
    if (!resourceId || !selected) {
      alert('请选择可备份资源');
      return;
    }
    onCreate({
      resourceId,
      name: name.trim() || `${selected.name} 备份计划`,
      backupType: backupType === 'auto' ? undefined : backupType,
      retentionDays,
      destinationType,
    });
    setName('');
    setBackupType('auto');
    setDestinationType('local');
    setRetentionDays(7);
  });

  return (
    <div className="rounded-lg border p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(180px,0.6fr)_minmax(160px,0.5fr)_minmax(140px,0.4fr)_auto]">
        <Field label="资源">
          <select
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="">请选择资源</option>
            {resources.map((r) => (
              <option
                key={r.id}
                value={r.id}
              >
                {r.name} · {providerLabels[r.provider] || r.provider} ·{' '}
                {kindLabels[r.kind] || r.kind}
              </option>
            ))}
          </select>
        </Field>
        <Field label="名称">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={selected ? `${selected.name} 备份计划` : '备份计划名称'}
            className="w-full rounded-md border px-3 py-2"
          />
        </Field>
        <Field label="类型">
          <select
            value={backupType}
            onChange={(e) => setBackupType(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="auto">自动</option>
            <option value="logical">逻辑备份</option>
            <option value="snapshot">快照</option>
            <option value="file">文件备份</option>
          </select>
        </Field>
        <Field label="保留天数">
          <input
            type="number"
            min={1}
            value={retentionDays}
            onChange={(e) => setRetentionDays(Number(e.target.value))}
            className="w-full rounded-md border px-3 py-2"
          />
        </Field>
        <div className="flex items-end">
          <button
            onClick={handleSubmit}
            disabled={creating || !resourceId}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            {creating ? '创建中...' : '创建计划'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
    </label>
  );
}
