/**
 * 创建告警规则 — 表单字段集合
 *
 * 单一职责:从 create-rule-modal 抽出纯展示字段,使 modal 文件回到 200 行以内。
 * 字段渲染依赖 react-hook-form 的 register(由父级传入),派生开关由父级计算。
 */
'use client';

import { useTranslations } from 'next-intl';
import type { UseFormRegister } from 'react-hook-form';
import { Checkbox, Input, Select, Textarea } from '@/components/ui';
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
        <Input
          {...register('name', { required: true })}
          required
        />
      </FieldLabel>
      <FieldLabel label={t('formCategory')}>
        <Select {...register('category')}>
          {Object.entries(categoryLabels).map(([value, label]) => (
            <option
              key={value}
              value={value}
            >
              {label}
            </option>
          ))}
        </Select>
      </FieldLabel>
      {showTarget ? (
        <FieldLabel
          label={t('formTarget')}
          hint={t('formTargetHint')}
        >
          <Select {...register('targetId')}>
            <option value="">{t('formTargetAll')}</option>
            {categoryTargets.map((opt) => (
              <option
                key={opt.id}
                value={opt.id}
              >
                {opt.name}
              </option>
            ))}
          </Select>
        </FieldLabel>
      ) : null}
      <FieldLabel label={t('formMetric')}>
        <Select {...register('metric')}>
          {Object.entries(metricLabels).map(([value, label]) => (
            <option
              key={value}
              value={value}
            >
              {label}
            </option>
          ))}
        </Select>
      </FieldLabel>
      <FieldLabel label={t('formSeverity')}>
        <Select {...register('severity')}>
          {Object.entries(severityLabels).map(([value, label]) => (
            <option
              key={value}
              value={value}
            >
              {label}
            </option>
          ))}
        </Select>
      </FieldLabel>
      {showThresholdDays ? (
        <FieldLabel label={t('formThresholdDays')}>
          <Input
            type="number"
            min={1}
            {...register('thresholdDays')}
            placeholder="14"
          />
        </FieldLabel>
      ) : null}
      <FieldLabel
        label={t('formEvaluationMode')}
        hint={t('formEvaluationModeHint')}
      >
        <Select {...register('evaluationMode')}>
          <option value="schedule">{t('formEvaluationModeSchedule')}</option>
          <option value="manual">{t('formEvaluationModeManual')}</option>
        </Select>
      </FieldLabel>
      {showInterval ? (
        <FieldLabel
          label={t('formIntervalSeconds')}
          hint={t('formIntervalSecondsHint')}
        >
          <Input
            type="number"
            min={30}
            step={30}
            {...register('intervalSeconds')}
            placeholder="60"
          />
        </FieldLabel>
      ) : null}
      <FieldLabel
        label={t('formConditionAdvanced')}
        hint={t('formConditionHint')}
      >
        <Textarea
          {...register('condition')}
          rows={3}
          className="font-mono text-xs"
          placeholder='{"thresholdDays": 14}'
        />
      </FieldLabel>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox {...register('enabled')} />
        <span className="font-medium">{t('formEnabled')}</span>
      </label>
    </>
  );
}
