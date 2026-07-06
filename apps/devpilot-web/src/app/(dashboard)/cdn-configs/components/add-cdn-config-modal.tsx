/**
 * 添加 CDN 配置弹窗
 *
 * 单一职责：收集 CDN 配置字段并提交。
 * react-hook-form 样板：取代手写 useSetState + 受控 onChange。
 */

import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui';
import { ErrorBanner } from '@/components/ui';
import type { TeamCredential, CDNConfigInput } from '../types';

interface AddCDNConfigModalProps {
  open: boolean;
  credentials: TeamCredential[];
  onClose: () => void;
  onCreate: (input: CDNConfigInput) => Promise<void>;
}

export function AddCDNConfigModal({
  open,
  credentials,
  onClose,
  onCreate,
}: AddCDNConfigModalProps) {
  const t = useTranslations('cdnConfigs');
  const tc = useTranslations('common');
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState,
  } = useForm<CDNConfigInput>({
    defaultValues: {
      name: '',
      domain: '',
      origin: '',
      provider: 'qiniu',
      credentialId: '',
    },
  });

  const provider = watch('provider');
  const filteredCredentials = useMemo(
    () => credentials.filter((c) => c.type === `cdn_${provider}`),
    [credentials, provider],
  );

  const handleProviderChange = (value: CDNConfigInput['provider']) => {
    setValue('provider', value);
    setValue('credentialId', '');
  };

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
      title={t('addConfig')}
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
          <span className="mb-1 block font-medium">{t('configName')}</span>
          <input
            {...register('name', { required: true })}
            required
            className="w-full rounded-md border px-3 py-2"
            placeholder={t('configNamePlaceholder')}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('providerLabel')}</span>
          <select
            {...register('provider')}
            onChange={(e) => handleProviderChange(e.target.value as CDNConfigInput['provider'])}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="qiniu">{t('providerQiniu')}</option>
            <option value="aliyun">{t('providerAliyun')}</option>
            <option value="cloudflare">{t('providerCloudflare')}</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('credential')}</span>
          <select
            {...register('credentialId', { required: true })}
            required
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="">{t('selectCredential')}</option>
            {filteredCredentials.map((c) => (
              <option
                key={c.id}
                value={c.id}
              >
                {c.name}
              </option>
            ))}
          </select>
          {filteredCredentials.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">{t('noCredentialsHint')}</p>
          ) : null}
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('domain')}</span>
          <input
            {...register('domain', { required: true })}
            required
            className="w-full rounded-md border px-3 py-2"
            placeholder="cdn.example.com"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('originAddress')}</span>
          <input
            {...register('origin', { required: true })}
            required
            className="w-full rounded-md border px-3 py-2"
            placeholder="origin.example.com"
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
