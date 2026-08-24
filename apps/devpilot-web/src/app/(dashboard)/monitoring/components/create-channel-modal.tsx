/**
 * 创建通知通道弹窗
 *
 * 单一职责：收集通道字段并提交 useMonitoring.createNotificationChannel。
 * 字段对齐后端 CreateAlertNotificationChannelDto：
 * name/type/webhookUrl/emailRecipients/emailSubjectPrefix/eventStatuses/severityFilter。
 */

import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Checkbox, ErrorBanner, Input, Modal, Select } from '@/components/ui';
import { feedback } from '@/components/ui/feedback/feedback';
import {
  notificationChannelTargetPlaceholders,
  notificationChannelTypeLabels,
  statusLabels,
} from '../constants';
import { FieldLabel, ModalFormFooter } from './modal-form-fields';

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
        <FieldLabel label={tc('name')}>
          <Input
            {...register('name', { required: true })}
            required
          />
        </FieldLabel>
        <FieldLabel label={tc('type')}>
          <Select {...register('type')}>
            {Object.entries(notificationChannelTypeLabels).map(([value, label]) => (
              <option
                key={value}
                value={value}
              >
                {label}
              </option>
            ))}
          </Select>
        </FieldLabel>
        {isEmail ? (
          <>
            <FieldLabel label={t('formEmailRecipients')}>
              <Input
                {...register('emailRecipients', { required: isEmail })}
                required={isEmail}
                placeholder={notificationChannelTargetPlaceholders.email}
              />
            </FieldLabel>
            <FieldLabel label={t('formEmailSubjectPrefix')}>
              <Input {...register('emailSubjectPrefix')} />
            </FieldLabel>
          </>
        ) : (
          <FieldLabel label={t('formWebhookUrl')}>
            <Input
              {...register('webhookUrl', { required: !isEmail })}
              required={!isEmail}
              placeholder={notificationChannelTargetPlaceholders[channelType] || ''}
            />
          </FieldLabel>
        )}
        <fieldset className="text-sm">
          <span className="mb-1 block font-medium">{t('formEventStatuses')}</span>
          <div className="flex flex-wrap gap-3">
            {EVENT_STATUS_OPTIONS.map((status) => (
              <label
                key={status}
                className="flex items-center gap-1.5"
              >
                <Checkbox
                  value={status}
                  {...register('eventStatuses')}
                />
                <span>{statusLabels[status] || status}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <FieldLabel label={t('formSeverityFilter')}>
          <Input
            {...register('severityFilter')}
            placeholder="warning, critical"
          />
        </FieldLabel>
        <ModalFormFooter
          creating={creating}
          submitting={formState.isSubmitting}
          onClose={onClose}
        />
      </form>
    </Modal>
  );
}
