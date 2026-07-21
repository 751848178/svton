/**
 * 创建告警静默弹窗
 *
 * 单一职责：收集静默字段并提交 useMonitoring.createSilence。
 * 字段对齐后端 CreateAlertSilenceDto：name/category/severityFilter/startsAt/endsAt/reason。
 */

import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { ErrorBanner, Modal } from '@/components/ui';
import { feedback } from '@/components/ui/feedback/feedback';
import { categoryLabels } from '../constants';

interface CreateSilenceFormValues {
  name: string;
  category: string;
  severityFilter: string;
  startsAt: string;
  endsAt: string;
  reason: string;
}

interface CreateSilenceModalProps {
  open: boolean;
  creating: boolean;
  error: string;
  onClose: () => void;
  onCreate: (body: Record<string, unknown>) => Promise<boolean>;
}

/** datetime-local 输入框需要的本地时间格式（YYYY-MM-DDTHH:mm）。 */
function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function CreateSilenceModal({
  open,
  creating,
  error,
  onClose,
  onCreate,
}: CreateSilenceModalProps) {
  const t = useTranslations('monitoring');
  const tc = useTranslations('common');
  const { register, handleSubmit, formState, reset } = useForm<CreateSilenceFormValues>({
    defaultValues: {
      name: '',
      category: '',
      severityFilter: '',
      startsAt: toLocalInputValue(new Date()),
      endsAt: '',
      reason: '',
    },
  });

  const submit = handleSubmit(async (data) => {
    const body: Record<string, unknown> = { name: data.name };
    if (data.category) body.category = data.category;
    const severities = data.severityFilter
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (severities.length > 0) body.severityFilter = severities;
    if (data.startsAt) body.startsAt = new Date(data.startsAt).toISOString();
    if (data.endsAt) body.endsAt = new Date(data.endsAt).toISOString();
    if (data.reason.trim()) body.reason = data.reason.trim();
    const ok = await onCreate(body);
    if (ok) {
      feedback.success(t('silenceCreated'));
      reset();
      onClose();
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('createSilence')}
    >
      <form
        onSubmit={submit}
        className="space-y-4"
      >
        <ErrorBanner
          message={error}
          variant="inline"
        />
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
            <option value="">{tc('all')}</option>
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
          <span className="mb-1 block font-medium">{t('formSeverityFilter')}</span>
          <input
            {...register('severityFilter')}
            className="min-h-11 w-full rounded-md border px-3"
            placeholder="warning, critical"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('formStartsAt')}</span>
          <input
            type="datetime-local"
            {...register('startsAt')}
            className="min-h-11 w-full rounded-md border px-3"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('formEndsAt')}</span>
          <input
            type="datetime-local"
            {...register('endsAt')}
            className="min-h-11 w-full rounded-md border px-3"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('formReason')}</span>
          <input
            {...register('reason')}
            className="min-h-11 w-full rounded-md border px-3"
          />
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
