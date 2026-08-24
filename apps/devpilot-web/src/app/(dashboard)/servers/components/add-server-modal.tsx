/**
 * 添加服务器弹窗
 *
 * 单一职责：收集服务器字段（含密码/密钥切换）并提交。
 * react-hook-form 样板：取代手写 useSetState + useState + 受控 onChange。
 */

'use client';

import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Input, Modal, ErrorBanner, Select, Textarea } from '@/components/ui';
import type { ServerInput } from '../types';

interface AddServerModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: ServerInput) => Promise<void>;
}

interface ServerForm {
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  credentials: string;
  tags: string;
}

export function AddServerModal({ open, onClose, onCreate }: AddServerModalProps) {
  const t = useTranslations('servers');
  const tc = useTranslations('common');
  const { register, handleSubmit, watch, setError, formState } = useForm<ServerForm>({
    defaultValues: {
      name: '',
      host: '',
      port: 22,
      username: 'root',
      authType: 'password',
      credentials: '',
      tags: '',
    },
  });
  const saving = formState.isSubmitting;
  const error = (formState.errors.root as { message?: string } | undefined)?.message || '';
  const authType = watch('authType');

  const onSubmit = async (data: ServerForm) => {
    try {
      await onCreate({
        name: data.name,
        host: data.host,
        port: Number(data.port),
        username: data.username,
        authType: data.authType,
        credentials: data.credentials,
        tags: data.tags ? data.tags.split(',').map((t) => t.trim()) : [],
      });
      onClose();
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : t('addFailed') });
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('addServer')}
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
      >
        {error ? (
          <ErrorBanner
            message={error}
            variant="inline"
          />
        ) : null}
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('serverName')}</span>
          <Input
            {...register('name')}
            required
            placeholder={t('serverNamePlaceholder')}
          />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="col-span-2 block text-sm">
            <span className="mb-1 block font-medium">{t('host')}</span>
            <Input
              {...register('host')}
              required
              placeholder="192.168.1.1"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t('port')}</span>
            <Input
              type="number"
              {...register('port', { valueAsNumber: true })}
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('username')}</span>
          <Input
            {...register('username')}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('authType')}</span>
          <Select {...register('authType')}>
            <option value="password">{t('passwordAuth')}</option>
            <option value="key">{t('sshPrivateKey')}</option>
          </Select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">
            {authType === 'password' ? t('password') : t('sshPrivateKey')}
          </span>
          {authType === 'password' ? (
            <Input
              type="password"
              {...register('credentials')}
              required
            />
          ) : (
            <Textarea
              {...register('credentials')}
              required
              rows={4}
              className="font-mono text-xs"
              placeholder="-----BEGIN RSA PRIVATE KEY-----"
            />
          )}
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('tagsCommaSeparated')}</span>
          <Input
            {...register('tags')}
            placeholder="production, web"
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
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? t('adding') : tc('add')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
