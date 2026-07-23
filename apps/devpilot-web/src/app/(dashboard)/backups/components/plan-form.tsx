/**
 * 备份计划创建表单
 *
 * 单一职责：收集表单输入并提交创建。
 * react-hook-form 样板：取代手写多个 useState + 受控 onChange。
 */

'use client';

import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { feedback } from '@/components/ui/feedback/feedback';
import type { ManagedResource, BackupPlanInput } from '../types';
import { providerLabels, kindLabels } from '../constants';

interface PlanFormProps {
  resources: ManagedResource[];
  creating: boolean;
  onCreate: (input: BackupPlanInput) => Promise<boolean>;
}

interface PlanFormValues {
  resourceId: string;
  name: string;
  backupType: string;
  destinationType: string;
  retentionDays: number;
}

const DEFAULT_VALUES: PlanFormValues = {
  resourceId: '',
  name: '',
  backupType: 'auto',
  destinationType: 'local',
  retentionDays: 7,
};

export function PlanForm({ resources, creating, onCreate }: PlanFormProps) {
  const t = useTranslations('backups');
  const tc = useTranslations('common');
  const { register, handleSubmit, watch, reset } = useForm<PlanFormValues>({
    defaultValues: DEFAULT_VALUES,
  });

  const resourceId = watch('resourceId');
  const selected = resources.find((r) => r.id === resourceId);

  const onSubmit = handleSubmit(async (data) => {
    if (!data.resourceId || !selected) {
      feedback.error(t('selectResourceAlert'));
      return;
    }
    // 仅在创建成功时 reset，失败时保留用户已填值以便修正后重试（createPlan 在底层吞错，
    // 故由 handleCreate 返回 boolean 明确表达结果，对齐 monitoring create-rule-modal 模式）。
    const ok = await onCreate({
      resourceId: data.resourceId,
      name: data.name.trim() || t('defaultPlanName', { name: selected.name }),
      backupType: data.backupType === 'auto' ? undefined : data.backupType,
      retentionDays: data.retentionDays,
      destinationType: data.destinationType,
    });
    if (ok) reset(DEFAULT_VALUES);
  });

  return (
    <div className="rounded-lg border p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(180px,0.6fr)_minmax(160px,0.5fr)_minmax(140px,0.4fr)_auto]">
        <Field label={t('resource')}>
          <select
            {...register('resourceId')}
            className="min-h-11 w-full rounded-md border px-3 py-2"
          >
            <option value="">{t('selectResource')}</option>
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
        <Field label={tc('name')}>
          <input
            {...register('name')}
            placeholder={selected ? t('defaultPlanName', { name: selected.name }) : t('planName')}
            className="min-h-11 w-full rounded-md border px-3 py-2"
          />
        </Field>
        <Field label={tc('type')}>
          <select
            {...register('backupType')}
            className="min-h-11 w-full rounded-md border px-3 py-2"
          >
            <option value="auto">{t('backupTypeAuto')}</option>
            <option value="logical">{t('backupTypeLogical')}</option>
            <option value="snapshot">{t('backupTypeSnapshot')}</option>
            <option value="file">{t('backupTypeFile')}</option>
          </select>
        </Field>
        <Field label={t('retentionDays')}>
          <input
            type="number"
            min={1}
            {...register('retentionDays', { valueAsNumber: true })}
            className="min-h-11 w-full rounded-md border px-3 py-2"
          />
        </Field>
        <div className="flex items-end">
          <button
            onClick={onSubmit}
            disabled={creating || !resourceId}
            className="min-h-11 w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            {creating ? t('creating') : t('createPlan')}
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
