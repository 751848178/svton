/**
 * 创建通知通道弹窗
 *
 * 单一职责：收集通道字段并提交 useMonitoring.createNotificationChannel。
 * 字段对齐后端 CreateAlertNotificationChannelDto：
 * name/type/webhookUrl/emailRecipients/emailSubjectPrefix/eventStatuses/severityFilter。
 */

import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { ErrorBanner, Modal } from '@/components/ui';
import { feedback } from '@/components/ui/feedback/feedback';
import {
  notificationChannelTargetPlaceholders,
  notificationChannelTypeLabels,
  statusLabels,
} from '../constants';

const EVENT_STATUS_OPTIONS = ['firing', 'error', 'insufficient_data', 'resolved', 'acknowledged'];

interface CreateChannelFormValues {
  name: string;
  type: string;
  webhookUrl: string;
  emailRecipients: string;
  emailSubjectPrefix: string;
  eventStatuses: string[];
  severityFilter: string;
}

interface CreateChannelModalProps {
  open: boolean;
  creating: boolean;
  error: string;
  onClose: () => void;
  onCreate: (body: Record<string, unknown>) => Promise<boolean>;
}

export function CreateChannelModal({
  open,
  creating,
  error,
  onClose,
  onCreate,
}: CreateChannelModalProps) {
  const t = useTranslations('monitoring');
  const tc = useTranslations('common');
  const { register, handleSubmit, watch, formState, reset } = useForm<CreateChannelFormValues>({
    defaultValues: {
      name: '',
      type: 'webhook',
      webhookUrl: '',
      emailRecipients: '',
      emailSubjectPrefix: '',
      eventStatuses: ['firing', 'error'],
      severityFilter: '',
    },
  });

  const channelType = watch('type');
  const isEmail = channelType === 'email';

  const submit = handleSubmit(async (data) => {
    const body: Record<string, unknown> = {
      name: data.name,
      type: data.type,
    };
    if (isEmail) {
      const recipients = data.emailRecipients
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      if (recipients.length > 0) body.emailRecipients = recipients;
      if (data.emailSubjectPrefix.trim()) body.emailSubjectPrefix = data.emailSubjectPrefix.trim();
    } else if (data.webhookUrl.trim()) {
      body.webhookUrl = data.webhookUrl.trim();
    }
    if (data.eventStatuses.length > 0) body.eventStatuses = data.eventStatuses;
    const severities = data.severityFilter
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (severities.length > 0) body.severityFilter = severities;
    const ok = await onCreate(body);
    if (ok) {
      feedback.success(t('channelCreated'));
      reset();
      onClose();
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('createChannel')}
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
          <span className="mb-1 block font-medium">{tc('type')}</span>
          <select
            {...register('type')}
            className="min-h-11 w-full rounded-md border px-3"
          >
            {Object.entries(notificationChannelTypeLabels).map(([value, label]) => (
              <option
                key={value}
                value={value}
              >
                {label}
              </option>
            ))}
          </select>
        </label>
        {isEmail ? (
          <>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">{t('formEmailRecipients')}</span>
              <input
                {...register('emailRecipients', { required: isEmail })}
                required={isEmail}
                className="min-h-11 w-full rounded-md border px-3"
                placeholder={notificationChannelTargetPlaceholders.email}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">{t('formEmailSubjectPrefix')}</span>
              <input
                {...register('emailSubjectPrefix')}
                className="min-h-11 w-full rounded-md border px-3"
              />
            </label>
          </>
        ) : (
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t('formWebhookUrl')}</span>
            <input
              {...register('webhookUrl', { required: !isEmail })}
              required={!isEmail}
              className="min-h-11 w-full rounded-md border px-3"
              placeholder={notificationChannelTargetPlaceholders[channelType] || ''}
            />
          </label>
        )}
        <fieldset className="text-sm">
          <span className="mb-1 block font-medium">{t('formEventStatuses')}</span>
          <div className="flex flex-wrap gap-3">
            {EVENT_STATUS_OPTIONS.map((status) => (
              <label
                key={status}
                className="flex items-center gap-1.5"
              >
                <input
                  type="checkbox"
                  value={status}
                  {...register('eventStatuses')}
                />
                <span>{statusLabels[status] || status}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('formSeverityFilter')}</span>
          <input
            {...register('severityFilter')}
            className="min-h-11 w-full rounded-md border px-3"
            placeholder="warning, critical"
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
