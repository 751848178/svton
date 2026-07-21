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

interface CreateRuleFormValues {
  name: string;
  category: string;
  metric: string;
  severity: string;
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
  const { register, handleSubmit, setError, formState, reset } = useForm<CreateRuleFormValues>({
    defaultValues: {
      name: '',
      category: 'service',
      metric: 'service_status',
      severity: 'warning',
      condition: '',
      enabled: true,
    },
  });

  const submit = handleSubmit(async (data) => {
    const body: Record<string, unknown> = {
      name: data.name,
      category: data.category,
      severity: data.severity,
      enabled: data.enabled,
    };
    if (data.metric) body.metric = data.metric;
    const conditionText = data.condition.trim();
    if (conditionText) {
      try {
        body.condition = JSON.parse(conditionText) as Record<string, unknown>;
      } catch {
        setError('root', { message: t('formConditionInvalid') });
        return;
      }
    }
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
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{tc('name')}</span>
          <input
            {...register('name', { required: true })}
            required
            className="min-h-11 w-full rounded-md border px-3"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('formCategory')}</span>
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
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('formMetric')}</span>
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
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('formSeverity')}</span>
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
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('formCondition')}</span>
          <textarea
            {...register('condition')}
            rows={3}
            className="w-full rounded-md border px-3 py-2 font-mono text-xs"
            placeholder='{"thresholdDays": 14}'
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            {...register('enabled')}
          />
          <span className="font-medium">{t('formEnabled')}</span>
        </label>
        <div className="flex justify-end gap-2 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-md border px-4 text-sm font-medium hover:bg-accent"
          >
            {tc('cancel')}
          </button>
          <button
            type="submit"
            disabled={creating || formState.isSubmitting}
            className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {creating || formState.isSubmitting ? t('creating') : tc('create')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
