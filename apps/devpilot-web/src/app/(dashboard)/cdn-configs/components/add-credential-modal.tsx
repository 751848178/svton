/**
 * 添加凭证弹窗
 *
 * 单一职责：收集 CDN 凭证字段并提交。
 * react-hook-form 样板：取代手写 useSetState + 受控 onChange。
 */

import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { ErrorBanner, Input, Modal, Select } from '@/components/ui';
import type { CredentialInput } from '../types';

interface AddCredentialModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: CredentialInput) => Promise<void>;
}

export function AddCredentialModal({ open, onClose, onCreate }: AddCredentialModalProps) {
  const t = useTranslations('cdnConfigs');
  const tc = useTranslations('common');
  const {
    register,
    handleSubmit,
    setError,
    formState,
  } = useForm<CredentialInput>({
    defaultValues: {
      name: '',
      type: 'cdn_qiniu',
      accessKey: '',
      secretKey: '',
    },
  });

  const submit = handleSubmit(async (data) => {
    try {
      await onCreate(data);
      onClose();
    } catch (err) {
      setError('root', {
        message: err instanceof Error ? err.message : t('addFailed'),
      });
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('addCredential')}
    >
      <form
        onSubmit={submit}
        className="space-y-4"
      >
        {(formState.errors.root as { message?: string } | undefined)?.message ? (
          <ErrorBanner
            message={(formState.errors.root as { message?: string } | undefined)?.message || ''}
            variant="inline"
          />
        ) : null}
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('credentialName')}</span>
          <Input
            {...register('name', { required: true })}
            required
            placeholder={t('credentialNamePlaceholder')}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('providerLabel')}</span>
          <Select {...register('type')}>
            <option value="cdn_qiniu">{t('providerQiniu')}</option>
            <option value="cdn_aliyun">{t('providerAliyun')}</option>
            <option value="cdn_cloudflare">{t('providerCloudflare')}</option>
          </Select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Access Key</span>
          <Input
            {...register('accessKey', { required: true })}
            required
            className="font-mono"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Secret Key</span>
          <Input
            type="password"
            {...register('secretKey', { required: true })}
            required
            className="font-mono"
          />
        </label>
        <div className="flex justify-end gap-2 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {tc('cancel')}
          </button>
          <button
            type="submit"
            disabled={formState.isSubmitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {formState.isSubmitting ? t('adding') : tc('add')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
