/**
 * 创建告警规则 — 表单字段集合
 *
 * 单一职责:从 create-rule-modal 抽出纯展示字段,使 modal 文件回到 200 行以内。
 * 字段渲染依赖 react-hook-form 的 register(由父级传入),派生开关由父级计算。
 */
'use client';

import { useTranslations } from 'next-intl';
import type { UseFormRegister } from 'react-hook-form';
import { FieldLabel } from './modal-form-fields';
import { categoryLabels, metricLabels, severityLabels } from '../constants';
import type { CreateRuleFormValues } from './create-rule-modal';
import type { TargetOption } from './create-rule-modal';

interface CreateRuleFormFieldsProps {
  register: UseFormRegister<CreateRuleFormValues>;
  showTarget: boolean;
  categoryTargets: TargetOption[];
  showThresholdDays: boolean;
  showInterval: boolean;
}

export function CreateRuleFormFields({
  register,
  showTarget,
  categoryTargets,
  showThresholdDays,
  showInterval,
}: CreateRuleFormFieldsProps) {
  const t = useTranslations('monitoring');
  const tc = useTranslations('common');
  return (
    <>
      <FieldLabel label={tc('name')}>
        <input
          {...register('name', { required: true })}
          required
          className="min-h-11 w-full rounded-md border px-3"
        />
      </FieldLabel>
      <FieldLabel label={t('formCategory')}>
        <select
          {...register('category')}
          className="min-h-11 w-full rounded-md border px-3"
        >
          {Object.entries(categoryLabels).map(([value, label]) => (
            <option
              key={value}
              value={value}
            >
              {label}
            </option>
          ))}
        </select>
      </FieldLabel>
      {showTarget ? (
        <FieldLabel
          label={t('formTarget')}
          hint={t('formTargetHint')}
        >
          <select
            {...register('targetId')}
            className="min-h-11 w-full rounded-md border px-3"
          >
            <option value="">{t('formTargetAll')}</option>
            {categoryTargets.map((opt) => (
              <option
                key={opt.id}
                value={opt.id}
              >
                {opt.name}
              </option>
            ))}
          </select>
        </FieldLabel>
      ) : null}
      <FieldLabel label={t('formMetric')}>
        <select
          {...register('metric')}
          className="min-h-11 w-full rounded-md border px-3"
        >
          {Object.entries(metricLabels).map(([value, label]) => (
            <option
              key={value}
              value={value}
            >
              {label}
            </option>
          ))}
        </select>
      </FieldLabel>
      <FieldLabel label={t('formSeverity')}>
        <select
          {...register('severity')}
          className="min-h-11 w-full rounded-md border px-3"
        >
          {Object.entries(severityLabels).map(([value, label]) => (
            <option
              key={value}
              value={value}
            >
              {label}
            </option>
          ))}
        </select>
      </FieldLabel>
      {showThresholdDays ? (
        <FieldLabel label={t('formThresholdDays')}>
          <input
            type="number"
            min={1}
            {...register('thresholdDays')}
            className="min-h-11 w-full rounded-md border px-3"
            placeholder="14"
          />
        </FieldLabel>
      ) : null}
      <FieldLabel
        label={t('formEvaluationMode')}
        hint={t('formEvaluationModeHint')}
      >
        <select
          {...register('evaluationMode')}
          className="min-h-11 w-full rounded-md border px-3"
        >
          <option value="schedule">{t('formEvaluationModeSchedule')}</option>
          <option value="manual">{t('formEvaluationModeManual')}</option>
        </select>
      </FieldLabel>
      {showInterval ? (
        <FieldLabel
          label={t('formIntervalSeconds')}
          hint={t('formIntervalSecondsHint')}
        >
          <input
            type="number"
            min={30}
            step={30}
            {...register('intervalSeconds')}
            className="min-h-11 w-full rounded-md border px-3"
            placeholder="60"
          />
        </FieldLabel>
      ) : null}
      <FieldLabel
        label={t('formConditionAdvanced')}
        hint={t('formConditionHint')}
      >
        <textarea
          {...register('condition')}
          rows={3}
          className="w-full rounded-md border px-3 py-2 font-mono text-xs"
          placeholder='{"thresholdDays": 14}'
        />
      </FieldLabel>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          {...register('enabled')}
        />
        <span className="font-medium">{t('formEnabled')}</span>
      </label>
    </>
  );
}
