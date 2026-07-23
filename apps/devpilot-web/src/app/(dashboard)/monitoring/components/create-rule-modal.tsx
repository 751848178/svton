/**
 * 创建告警规则弹窗
 *
 * 单一职责：收集规则字段并提交 useMonitoring.createRule。
 * 字段对齐后端 CreateAlertRuleDto：name/category/metric/severity/condition/enabled。
 */

import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { ErrorBanner, Modal } from '@/components/ui';
import { feedback } from '@/components/ui/feedback/feedback';
import { categoryLabels, metricLabels, severityLabels } from '../constants';
import { FieldLabel, ModalFormFooter } from './modal-form-fields';

interface CreateRuleFormValues {
  name: string;
  category: string;
  metric: string;
  severity: string;
  thresholdDays: string;
  condition: string;
  enabled: boolean;
}

interface CreateRuleModalProps {
  open: boolean;
  creating: boolean;
  error: string;
  onClose: () => void;
  onCreate: (body: Record<string, unknown>) => Promise<boolean>;
}

export function CreateRuleModal({ open, creating, error, onClose, onCreate }: CreateRuleModalProps) {
  const t = useTranslations('monitoring');
  const tc = useTranslations('common');
  const { register, handleSubmit, setError, watch, formState, reset } = useForm<CreateRuleFormValues>({
    defaultValues: {
      name: '',
      category: 'service',
      metric: 'service_status',
      severity: 'warning',
      thresholdDays: '',
      condition: '',
      enabled: true,
    },
  });

  // 仅 certificate_expiry 提供结构化 thresholdDays 字段；其余指标 thresholdDays 无意义。
  const metric = watch('metric');
  const showThresholdDays = metric === 'certificate_expiry';

  const submit = handleSubmit(async (data) => {
    const body: Record<string, unknown> = {
      name: data.name,
      category: data.category,
      severity: data.severity,
      enabled: data.enabled,
    };
    if (data.metric) body.metric = data.metric;
    // 组装 condition：以结构化 thresholdDays 为准（若有），叠加高级 JSON 编辑。
    let condition: Record<string, unknown> | undefined;
    const conditionText = data.condition.trim();
    if (conditionText) {
      try {
        condition = JSON.parse(conditionText) as Record<string, unknown>;
      } catch {
        setError('root', { message: t('formConditionInvalid') });
        return;
      }
    }
    const thresholdRaw = data.thresholdDays.trim();
    if (thresholdRaw !== '') {
      const thresholdDays = Number(thresholdRaw);
      if (!Number.isFinite(thresholdDays) || thresholdDays <= 0) {
        setError('root', { message: t('formThresholdDaysInvalid') });
        return;
      }
      condition = { ...(condition ?? {}), thresholdDays };
    }
    if (condition) body.condition = condition;
    const ok = await onCreate(body);
    if (ok) {
      feedback.success(t('ruleCreated'));
      reset();
      onClose();
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('createRule')}
    >
      <form
        onSubmit={submit}
        className="space-y-4"
      >
        <ErrorBanner
          message={error}
          variant="inline"
        />
        {(formState.errors.root as { message?: string } | undefined)?.message ? (
          <ErrorBanner
            message={(formState.errors.root as { message?: string } | undefined)?.message || ''}
            variant="inline"
          />
        ) : null}
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
        <ModalFormFooter
          creating={creating}
          submitting={formState.isSubmitting}
          onClose={onClose}
        />
      </form>
    </Modal>
  );
}
