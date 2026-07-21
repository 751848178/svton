/**
 * 添加代理配置弹窗
 *
 * 单一职责：收集代理配置字段并提交。
 * react-hook-form 样板：取代手写 useSetState + 受控 onChange。
 */

'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Modal, ErrorBanner } from '@/components/ui';
import type { Server, ProxyConfigInput } from '../types';

interface AddProxyConfigModalProps {
  open: boolean;
  servers: Server[];
  /** 从 query 参数（?serverId=...）传入时预填目标服务器 */
  initialServerId?: string;
  onClose: () => void;
  onCreate: (input: ProxyConfigInput) => Promise<void>;
}

export function AddProxyConfigModal({
  open,
  servers,
  initialServerId,
  onClose,
  onCreate,
}: AddProxyConfigModalProps) {
  const t = useTranslations('proxyConfigs');
  const tc = useTranslations('common');
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState,
  } = useForm<ProxyConfigInput>({
    defaultValues: {
      name: '',
      domain: '',
      upstreamHost: '',
      upstreamPort: 80,
      sslEnabled: false,
      sslType: 'letsencrypt',
      websocket: false,
      serverId: initialServerId || '',
    },
  });

  // defaultValues 仅在挂载时生效；弹窗每次打开时同步 query 预填值
  useEffect(() => {
    if (open && initialServerId) {
      setValue('serverId', initialServerId);
    }
  }, [open, initialServerId, setValue]);

  const sslEnabled = watch('sslEnabled');

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
            className="min-h-11 w-full rounded-md border px-3"
            placeholder={t('configNamePlaceholder')}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('domain')}</span>
          <input
            {...register('domain', { required: true })}
            required
            className="min-h-11 w-full rounded-md border px-3"
            placeholder="example.com"
          />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="col-span-2 block text-sm">
            <span className="mb-1 block font-medium">{t('upstreamHost')}</span>
            <input
              {...register('upstreamHost', { required: true })}
              required
              className="min-h-11 w-full rounded-md border px-3"
              placeholder="127.0.0.1"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t('port')}</span>
            <input
              type="number"
              {...register('upstreamPort', { valueAsNumber: true })}
              className="min-h-11 w-full rounded-md border px-3"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('targetServer')}</span>
          <select
            {...register('serverId')}
            className="min-h-11 w-full rounded-md border px-3"
          >
            <option value="">{t('noServer')}</option>
            {servers.map((s) => (
              <option
                key={s.id}
                value={s.id}
              >
                {s.name} ({s.host})
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-2">
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              {...register('sslEnabled')}
              className="h-5 w-5 rounded"
            />
            <span className="text-sm">{t('enableSsl')}</span>
          </label>
          {sslEnabled ? (
            <select
              {...register('sslType')}
              className="min-h-11 w-full rounded-md border px-3 text-sm"
            >
              <option value="letsencrypt">{t('sslLetsencrypt')}</option>
              <option value="custom">{t('sslCustom')}</option>
            </select>
          ) : null}
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              {...register('websocket')}
              className="h-5 w-5 rounded"
            />
            <span className="text-sm">{t('enableWebsocket')}</span>
          </label>
        </div>
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
            disabled={formState.isSubmitting}
            className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {formState.isSubmitting ? t('adding') : tc('add')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
